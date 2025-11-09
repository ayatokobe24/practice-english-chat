# API設計書

## 1. はじめに

### 1.1 目的
本設計書は、英語学習チャットアプリケーションのAPI設計を定義する。要件定義書に基づき、Next.js Server ActionsとSupabaseを使用したAPI設計を記載する。

### 1.2 技術スタック
- **フロントエンド/バックエンド**: Next.js 14+（App Router、Server Actions）
- **認証/データベース**: Supabase（PostgreSQL、Row Level Security、Realtime）
- **ストレージ**: Supabase Storage（音声ファイル）
- **AI統合**: Vercel AI SDK（LLM/TTS統合）
- **デプロイ**: Vercel（Edge Network、Serverless Functions）

### 1.3 設計方針
- **API形式**: Next.js Server Actions（`"use server"`ディレクティブ）
- **認証**: Supabase Auth（JWT トークン）
- **エラーハンドリング**: 統一されたエラーレスポンス形式
- **バリデーション**: Zodスキーマによる入力検証
- **型安全性**: TypeScriptによる型定義
- **パフォーマンス**: キャッシュ戦略、並列処理の活用

### 1.4 用語
- **Server Action**: Next.jsのサーバーサイドアクション（APIルート不要でデータ操作）
- **バブル**: 1件の学習メッセージ（テキスト＋音声再生＋ブックマークUI）
- **メッセージ**: AIが生成した学習テキスト
- **ブックマーク**: 学習メッセージを後学習用に保存したレコード

---

## 2. API一覧

| API ID | 説明 | Server Action名 | 優先度 | 認証 |
|--------|------|----------------|--------|------|
| API-001 | テーマ入力→3メッセージ生成 | `generateMessages` | M | 必須 |
| API-002 | メッセージ再生（音声URL取得） | `getAudioUrl` | M | 必須 |
| API-003 | ブックマーク登録 | `createBookmark` | M | 必須 |
| API-004 | ブックマーク一覧取得 | `getBookmarks` | M | 必須 |
| API-005 | ブックマーク削除 | `deleteBookmark` | M | 必須 |
| API-006 | メッセージ生成履歴取得 | `getMessageHistory` | S | 必須 |
| API-007 | ブックマーク更新（メモ/学習済み） | `updateBookmark` | M | 必須 |
| API-008 | タグ一覧取得 | `getTags` | M | 必須 |
| API-009 | ブックマークにタグ追加 | `addTagToBookmark` | M | 必須 |
| API-010 | ブックマークからタグ削除 | `removeTagFromBookmark` | M | 必須 |
| API-011 | ユーザー設定取得 | `getUserSettings` | S | 必須 |
| API-012 | ユーザー設定更新 | `updateUserSettings` | S | 必須 |
| API-013 | 通報作成 | `createAbuseReport` | S | 必須 |
| API-014 | 通報一覧取得（管理者） | `getAbuseReports` | S | 管理者 |
| API-015 | 通報審査（管理者） | `reviewAbuseReport` | S | 管理者 |
| API-016 | NG語辞書取得（管理者） | `getNgWords` | S | 管理者 |
| API-017 | NG語追加（管理者） | `addNgWord` | S | 管理者 |

---

## 3. 共通仕様

### 3.1 認証方式
- **方式**: Supabase Auth（JWT トークン）
- **実装**: Server Actions内で`createServerClient`を使用して認証状態を確認
- **エラー**: 未認証時は`401 Unauthorized`を返却

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function getAuthenticatedUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
  
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error('Unauthorized')
  }
  
  return user
}
```

### 3.2 エラーレスポンス形式

```typescript
interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: unknown
  }
}
```

**エラーコード一覧**:
- `UNAUTHORIZED`: 認証エラー（401）
- `FORBIDDEN`: 権限不足（403）
- `NOT_FOUND`: リソース不存在（404）
- `VALIDATION_ERROR`: バリデーションエラー（400）
- `CONFLICT`: 重複エラー（409）
- `INTERNAL_ERROR`: サーバーエラー（500）
- `LLM_ERROR`: LLM API エラー（502）
- `TTS_ERROR`: TTS API エラー（502）

### 3.3 成功レスポンス形式

```typescript
interface SuccessResponse<T> {
  data: T
  meta?: {
    total?: number
    page?: number
    limit?: number
  }
}
```

### 3.4 バリデーション
- **ライブラリ**: Zod
- **実装**: Server Actionの引数にZodスキーマを適用

```typescript
import { z } from 'zod'

const generateMessagesSchema = z.object({
  topic: z.string().min(1).max(500),
  level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
})
```

### 3.5 パフォーマンス要件
- **生成完了**: P95 ≤ 3.0s（FR-001）
- **再生開始**: P95 ≤ 300ms（FR-002）
- **Server Actions**: P95 ≤ 150ms（非生成系）

---

## 4. API詳細仕様

### 4.1 API-001: テーマ入力→3メッセージ生成

**Server Action**: `generateMessages`

**説明**: ユーザーが入力したテーマに基づいて、AIが3つの学習メッセージを生成する。

**リクエスト**:
```typescript
interface GenerateMessagesRequest {
  topic: string        // テーマ（1-500文字）
  level?: string      // 難易度レベル（A1, A2, B1, B2, C1, C2）
}
```

**バリデーション**:
- `topic`: 必須、1-500文字
- `level`: 任意、enum（A1, A2, B1, B2, C1, C2）

**処理フロー**:
1. 認証確認
2. NG語チェック（管理者設定）
3. LLM API呼び出し（Vercel AI SDK経由）で3メッセージ生成
4. ポストプロセス（長さ/レベル/禁則チェック）
5. TTS API呼び出し（Vercel AI SDK経由）で音声生成（並列処理）
6. Supabase Storageに音声ファイルをアップロード
7. メッセージと音声メタデータをDBに保存
8. レスポンス返却

**レスポンス**:
```typescript
interface GenerateMessagesResponse {
  requestId: string
  messages: Array<{
    id: string
    text: string
    audioUrl: string | null
    level: string | null
    sequence: number
    createdAt: string
  }>
  processingTimeMs: number
}
```

**エラーハンドリング**:
- LLM失敗時: リトライ（最大2回）→ 失敗時は縮退（1件のみ生成またはエラー）
- TTS失敗時: 音声なしでメッセージのみ返却
- タイムアウト: 3秒でタイムアウト、部分的な結果を返却

**パフォーマンス**:
- 目標: P95 ≤ 3.0s
- キャッシュ: 同一テーマ+レベルの組み合わせでキャッシュ（`unstable_cache`）

**実装例**:
```typescript
'use server'

import { createServerClient } from '@supabase/ssr'
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'

const generateMessagesSchema = z.object({
  topic: z.string().min(1).max(500),
  level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
})

export async function generateMessages(
  input: z.infer<typeof generateMessagesSchema>
) {
  // 認証確認
  const user = await getAuthenticatedUser()
  
  // バリデーション
  const validated = generateMessagesSchema.parse(input)
  
  // NG語チェック
  // ... NG語チェック処理
  
  // LLM呼び出し
  const result = await streamText({
    model: openai('gpt-4-turbo'),
    prompt: `Generate 3 English learning messages for topic: ${validated.topic}`,
  })
  
  // ... 処理続く
}
```

---

### 4.2 API-002: メッセージ再生（音声URL取得）

**Server Action**: `getAudioUrl`

**説明**: メッセージIDから音声ファイルのURLを取得する。

**リクエスト**:
```typescript
interface GetAudioUrlRequest {
  messageId: string
}
```

**レスポンス**:
```typescript
interface GetAudioUrlResponse {
  audioUrl: string
  durationSec: number | null
  format: string
}
```

**エラーハンドリング**:
- メッセージ不存在: `NOT_FOUND`
- 音声未生成: `audioUrl`が`null`の場合、エラーではなく空文字列を返却

**パフォーマンス**:
- 目標: P95 ≤ 150ms
- キャッシュ: Supabase StorageのCDNキャッシュを活用

---

### 4.3 API-003: ブックマーク登録

**Server Action**: `createBookmark`

**説明**: メッセージをブックマークに登録する。

**リクエスト**:
```typescript
interface CreateBookmarkRequest {
  messageId: string
  notes?: string      // ユーザーメモ
  tagIds?: string[]  // タグID配列
}
```

**バリデーション**:
- `messageId`: 必須、UUID形式
- `notes`: 任意、最大1000文字
- `tagIds`: 任意、UUID配列

**レスポンス**:
```typescript
interface CreateBookmarkResponse {
  id: string
  messageId: string
  notes: string | null
  isLearned: boolean
  tags: Array<{
    id: string
    name: string
    color: string | null
  }>
  createdAt: string
}
```

**エラーハンドリング**:
- 重複登録: `CONFLICT`（409）- 既にブックマーク済み
- メッセージ不存在: `NOT_FOUND`（404）

**実装例**:
```typescript
'use server'

export async function createBookmark(input: CreateBookmarkRequest) {
  const user = await getAuthenticatedUser()
  
  // 重複チェック
  const existing = await supabase
    .from('bookmarks')
    .select('id')
    .eq('user_id', user.id)
    .eq('message_id', input.messageId)
    .is('deleted_at', null)
    .single()
  
  if (existing.data) {
    throw new Error('Bookmark already exists')
  }
  
  // ブックマーク作成
  const { data, error } = await supabase
    .from('bookmarks')
    .insert({
      user_id: user.id,
      message_id: input.messageId,
      notes: input.notes || null,
    })
    .select()
    .single()
  
  // タグ追加
  if (input.tagIds && input.tagIds.length > 0) {
    // ... タグ関連処理
  }
  
  return { data }
}
```

---

### 4.4 API-004: ブックマーク一覧取得

**Server Action**: `getBookmarks`

**説明**: ユーザーのブックマーク一覧を取得する。検索・フィルタ・ページング対応。

**リクエスト**:
```typescript
interface GetBookmarksRequest {
  q?: string          // 検索クエリ（メッセージテキスト/トピック）
  tagId?: string      // タグIDでフィルタ
  isLearned?: boolean // 学習済みフラグでフィルタ
  page?: number       // ページ番号（1始まり）
  limit?: number      // 1ページあたりの件数（デフォルト20、最大100）
  sortBy?: 'created_at' | 'updated_at' | 'learned_at'
  sortOrder?: 'asc' | 'desc'
}
```

**バリデーション**:
- `q`: 任意、最大100文字
- `page`: 任意、最小1
- `limit`: 任意、1-100
- `sortBy`: 任意、enum
- `sortOrder`: 任意、enum

**レスポンス**:
```typescript
interface GetBookmarksResponse {
  bookmarks: Array<{
    id: string
    messageId: string
    message: {
      id: string
      text: string
      topic: string
      level: string | null
      audioUrl: string | null
    }
    notes: string | null
    isLearned: boolean
    learnedAt: string | null
    tags: Array<{
      id: string
      name: string
      color: string | null
    }>
    createdAt: string
    updatedAt: string
  }>
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}
```

**実装例**:
```typescript
'use server'

export async function getBookmarks(input: GetBookmarksRequest) {
  const user = await getAuthenticatedUser()
  
  const page = input.page || 1
  const limit = Math.min(input.limit || 20, 100)
  const offset = (page - 1) * limit
  
  let query = supabase
    .from('bookmarks')
    .select(`
      *,
      message:messages(*),
      bookmark_tags(
        tag:tags(*)
      )
    `)
    .eq('user_id', user.id)
    .is('deleted_at', null)
  
  // 検索
  if (input.q) {
    query = query.or(`message.text.ilike.%${input.q}%,message.topic.ilike.%${input.q}%`)
  }
  
  // フィルタ
  if (input.tagId) {
    query = query.eq('bookmark_tags.tag_id', input.tagId)
  }
  if (input.isLearned !== undefined) {
    query = query.eq('is_learned', input.isLearned)
  }
  
  // ソート
  const sortBy = input.sortBy || 'created_at'
  const sortOrder = input.sortOrder || 'desc'
  query = query.order(sortBy, { ascending: sortOrder === 'asc' })
  
  // ページング
  query = query.range(offset, offset + limit - 1)
  
  const { data, error, count } = await query
  
  return {
    data: {
      bookmarks: data || [],
      meta: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    },
  }
}
```

---

### 4.5 API-005: ブックマーク削除

**Server Action**: `deleteBookmark`

**説明**: ブックマークを削除する（論理削除）。確認フラグ必須。

**リクエスト**:
```typescript
interface DeleteBookmarkRequest {
  id: string
  confirm: boolean     // 確認フラグ（必須）
}
```

**バリデーション**:
- `id`: 必須、UUID形式
- `confirm`: 必須、`true`である必要がある

**レスポンス**:
```typescript
interface DeleteBookmarkResponse {
  success: boolean
}
```

**エラーハンドリング**:
- `confirm`が`false`または未指定: `VALIDATION_ERROR`（400）
- ブックマーク不存在: `NOT_FOUND`（404）
- 他ユーザーのブックマーク: `FORBIDDEN`（403）

**実装例**:
```typescript
'use server'

export async function deleteBookmark(input: DeleteBookmarkRequest) {
  const user = await getAuthenticatedUser()
  
  if (!input.confirm) {
    throw new Error('Confirmation required')
  }
  
  const { data, error } = await supabase
    .from('bookmarks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', input.id)
    .eq('user_id', user.id)
    .select()
    .single()
  
  if (!data) {
    throw new Error('Bookmark not found')
  }
  
  return { data: { success: true } }
}
```

---

### 4.6 API-006: メッセージ生成履歴取得

**Server Action**: `getMessageHistory`

**説明**: ユーザーのメッセージ生成履歴を取得する（直近50件）。

**リクエスト**:
```typescript
interface GetMessageHistoryRequest {
  limit?: number  // デフォルト50、最大50
}
```

**レスポンス**:
```typescript
interface GetMessageHistoryResponse {
  requests: Array<{
    id: string
    topic: string
    level: string | null
    messageCount: number
    status: 'processing' | 'completed' | 'failed' | 'partial'
    messages: Array<{
      id: string
      text: string
      audioUrl: string | null
    }>
    createdAt: string
    completedAt: string | null
  }>
}
```

---

### 4.7 API-007: ブックマーク更新

**Server Action**: `updateBookmark`

**説明**: ブックマークのメモや学習済みフラグを更新する。

**リクエスト**:
```typescript
interface UpdateBookmarkRequest {
  id: string
  notes?: string
  isLearned?: boolean
  tagIds?: string[]  // タグを置き換え
}
```

**レスポンス**:
```typescript
interface UpdateBookmarkResponse {
  id: string
  notes: string | null
  isLearned: boolean
  learnedAt: string | null
  tags: Array<{
    id: string
    name: string
  }>
  updatedAt: string
}
```

---

### 4.8 API-008: タグ一覧取得

**Server Action**: `getTags`

**説明**: 利用可能なタグ一覧を取得する。

**リクエスト**:
```typescript
interface GetTagsRequest {
  // パラメータなし
}
```

**レスポンス**:
```typescript
interface GetTagsResponse {
  tags: Array<{
    id: string
    name: string
    description: string | null
    color: string | null
    isSystem: boolean
  }>
}
```

---

### 4.9 API-009: ブックマークにタグ追加

**Server Action**: `addTagToBookmark`

**説明**: ブックマークにタグを追加する。

**リクエスト**:
```typescript
interface AddTagToBookmarkRequest {
  bookmarkId: string
  tagId: string
}
```

**レスポンス**:
```typescript
interface AddTagToBookmarkResponse {
  success: boolean
}
```

**エラーハンドリング**:
- 重複: `CONFLICT`（409）- 既にタグが付与済み

---

### 4.10 API-010: ブックマークからタグ削除

**Server Action**: `removeTagFromBookmark`

**説明**: ブックマークからタグを削除する。

**リクエスト**:
```typescript
interface RemoveTagFromBookmarkRequest {
  bookmarkId: string
  tagId: string
}
```

**レスポンス**:
```typescript
interface RemoveTagFromBookmarkResponse {
  success: boolean
}
```

---

### 4.11 API-011: ユーザー設定取得

**Server Action**: `getUserSettings`

**説明**: ユーザーの設定情報を取得する。

**リクエスト**:
```typescript
interface GetUserSettingsRequest {
  // パラメータなし
}
```

**レスポンス**:
```typescript
interface GetUserSettingsResponse {
  audioVoice: string | null
  audioSpeed: number
  theme: 'light' | 'dark' | 'auto'
  language: 'ja' | 'en'
  notificationEnabled: boolean
}
```

---

### 4.12 API-012: ユーザー設定更新

**Server Action**: `updateUserSettings`

**説明**: ユーザーの設定情報を更新する。

**リクエスト**:
```typescript
interface UpdateUserSettingsRequest {
  audioVoice?: string
  audioSpeed?: number
  theme?: 'light' | 'dark' | 'auto'
  language?: 'ja' | 'en'
  notificationEnabled?: boolean
}
```

**バリデーション**:
- `audioSpeed`: 0.5-2.0の範囲

**レスポンス**:
```typescript
interface UpdateUserSettingsResponse {
  audioVoice: string | null
  audioSpeed: number
  theme: 'light' | 'dark' | 'auto'
  language: 'ja' | 'en'
  notificationEnabled: boolean
}
```

---

### 4.13 API-013: 通報作成

**Server Action**: `createAbuseReport`

**説明**: 不適切コンテンツを通報する。

**リクエスト**:
```typescript
interface CreateAbuseReportRequest {
  targetType: 'message' | 'user' | 'bookmark'
  targetId: string
  reason: 'spam' | 'inappropriate' | 'copyright' | 'other'
  description?: string
}
```

**レスポンス**:
```typescript
interface CreateAbuseReportResponse {
  id: string
  status: 'pending'
  createdAt: string
}
```

---

### 4.14 API-014: 通報一覧取得（管理者）

**Server Action**: `getAbuseReports`

**説明**: 管理者が通報一覧を取得する。

**リクエスト**:
```typescript
interface GetAbuseReportsRequest {
  status?: 'pending' | 'reviewing' | 'resolved' | 'dismissed'
  page?: number
  limit?: number
}
```

**レスポンス**:
```typescript
interface GetAbuseReportsResponse {
  reports: Array<{
    id: string
    reporterId: string
    targetType: string
    targetId: string
    reason: string
    description: string | null
    status: string
    reviewedBy: string | null
    reviewedAt: string | null
    createdAt: string
  }>
  meta: {
    total: number
    page: number
    limit: number
  }
}
```

**権限**: 管理者のみ（`profiles.role = 'admin'`）

---

### 4.15 API-015: 通報審査（管理者）

**Server Action**: `reviewAbuseReport`

**説明**: 管理者が通報を審査する。

**リクエスト**:
```typescript
interface ReviewAbuseReportRequest {
  id: string
  status: 'resolved' | 'dismissed'
  reviewNotes?: string
}
```

**レスポンス**:
```typescript
interface ReviewAbuseReportResponse {
  id: string
  status: string
  reviewedAt: string
}
```

**権限**: 管理者のみ

---

### 4.16 API-016: NG語辞書取得（管理者）

**Server Action**: `getNgWords`

**説明**: 管理者がNG語辞書を取得する。

**リクエスト**:
```typescript
interface GetNgWordsRequest {
  category?: 'profanity' | 'hate_speech' | 'spam' | 'other'
  page?: number
  limit?: number
}
```

**レスポンス**:
```typescript
interface GetNgWordsResponse {
  words: Array<{
    id: string
    word: string
    category: string
    action: 'replace' | 'reject'
    replacement: string | null
    createdAt: string
  }>
  meta: {
    total: number
    page: number
    limit: number
  }
}
```

**権限**: 管理者のみ

---

### 4.17 API-017: NG語追加（管理者）

**Server Action**: `addNgWord`

**説明**: 管理者がNG語を追加する。

**リクエスト**:
```typescript
interface AddNgWordRequest {
  word: string
  category: 'profanity' | 'hate_speech' | 'spam' | 'other'
  action: 'replace' | 'reject'
  replacement?: string  // action='replace'時は必須
}
```

**バリデーション**:
- `word`: 必須、1-100文字
- `replacement`: `action='replace'`時は必須

**レスポンス**:
```typescript
interface AddNgWordResponse {
  id: string
  word: string
  category: string
  action: string
  replacement: string | null
  createdAt: string
}
```

**権限**: 管理者のみ

---

## 5. 認証・認可

### 5.1 認証フロー

1. **クライアントサイド**: Supabase Authでログイン
2. **Server Actions**: `createServerClient`で認証状態を確認
3. **RLS**: SupabaseのRow Level Securityで行レベルアクセス制御

### 5.2 認可チェック

```typescript
async function checkAdminRole(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  
  return data?.role === 'admin'
}
```

### 5.3 エラーハンドリング

- **401 Unauthorized**: 未認証
- **403 Forbidden**: 権限不足（管理者専用API等）

---

## 6. エラーハンドリング詳細

### 6.1 エラー分類

| エラーコード | HTTPステータス | 説明 | 例 |
|------------|---------------|------|-----|
| UNAUTHORIZED | 401 | 認証エラー | トークン無効、未ログイン |
| FORBIDDEN | 403 | 権限不足 | 管理者専用APIに一般ユーザーがアクセス |
| NOT_FOUND | 404 | リソース不存在 | 存在しないメッセージID |
| VALIDATION_ERROR | 400 | バリデーションエラー | 必須パラメータ不足、形式不正 |
| CONFLICT | 409 | 重複エラー | 既にブックマーク済み |
| LLM_ERROR | 502 | LLM API エラー | LLM API呼び出し失敗 |
| TTS_ERROR | 502 | TTS API エラー | TTS API呼び出し失敗 |
| INTERNAL_ERROR | 500 | サーバーエラー | 予期しないエラー |

### 6.2 エラーレスポンス例

```typescript
// バリデーションエラー
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid input",
    details: {
      field: "topic",
      issue: "String must contain at least 1 character(s)"
    }
  }
}

// LLMエラー
{
  error: {
    code: "LLM_ERROR",
    message: "Failed to generate messages",
    details: {
      provider: "openai",
      retryCount: 2
    }
  }
}
```

---

## 7. パフォーマンス最適化

### 7.1 キャッシュ戦略

1. **メッセージ生成結果**: 同一テーマ+レベルの組み合わせでキャッシュ
   ```typescript
   import { unstable_cache } from 'next/cache'
   
   const getCachedMessages = unstable_cache(
     async (topic: string, level?: string) => {
       // メッセージ生成処理
     },
     ['messages'],
     { revalidate: 3600 } // 1時間
   )
   ```

2. **音声ファイル**: Supabase StorageのCDNキャッシュを活用

3. **タグ一覧**: 頻繁にアクセスされるためキャッシュ

### 7.2 並列処理

- **TTS生成**: 3メッセージの音声生成を並列処理
  ```typescript
  const audioPromises = messages.map(message => 
    generateAudio(message.text)
  )
  const audios = await Promise.all(audioPromises)
  ```

### 7.3 データベース最適化

- インデックスを活用したクエリ最適化
- ページングで大量データ取得を回避
- JOINを最小化（必要なデータのみ取得）

---

## 8. セキュリティ

### 8.1 入力サニタイズ

- Zodスキーマによる型安全なバリデーション
- SQLインジェクション対策: Supabaseクライアントが自動対応
- XSS対策: 出力時のエスケープ

### 8.2 レート制限

- Vercel Edge Configでレート制限（Vercel Pro以上）
- ユーザー単位でのリクエスト数制限

### 8.3 プロンプトインジェクション対策

- システムプロンプトを固定
- ユーザー入力のサニタイズ
- NG語チェック

---

## 9. テスト方針

### 9.1 単体テスト

- Server Actionsの単体テスト
- バリデーションロジックのテスト
- エラーハンドリングのテスト

### 9.2 統合テスト

- Supabaseとの統合テスト
- AI SDKとの統合テスト

### 9.3 E2Eテスト

- Playwrightを使用したE2Eテスト
- 主要フローのテスト

### 9.4 負荷テスト

- 目標: Peak QPS=10
- 余裕: 2倍設計（20 QPS）
- Vercel Edge負荷分散を考慮

---

## 10. 監視・ログ

### 10.1 監視指標

- **レイテンシ**: Server Actionsの実行時間
- **エラー率**: エラー発生率
- **LLM/TTS失敗率**: AI API呼び出しの失敗率

### 10.2 ログ出力

- Vercel Analyticsでログ収集
- エラーログの詳細出力
- パフォーマンスログ

### 10.3 アラート

- LLM/TTS失敗率 > 1%（5分間）
- エラー率 > 5%（5分間）
- レイテンシ P95 > 3.0s（5分間）

---

## 11. 実装例（主要API）

### 11.1 generateMessages 実装例

```typescript
'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { generateSpeech } from 'ai'
import { z } from 'zod'
import { unstable_cache } from 'next/cache'

const generateMessagesSchema = z.object({
  topic: z.string().min(1).max(500),
  level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
})

export async function generateMessages(
  input: z.infer<typeof generateMessagesSchema>
) {
  const startTime = Date.now()
  
  try {
    // 認証確認
    const user = await getAuthenticatedUser()
    
    // バリデーション
    const validated = generateMessagesSchema.parse(input)
    
    // NG語チェック
    const ngWords = await checkNgWords(validated.topic)
    if (ngWords.some(w => w.action === 'reject')) {
      throw new Error('Topic contains inappropriate words')
    }
    
    // LLM呼び出し
    const result = await streamText({
      model: openai('gpt-4-turbo'),
      prompt: `Generate 3 English learning messages for topic: ${validated.topic}. Level: ${validated.level || 'B1'}. Each message should be 50-100 words.`,
      maxTokens: 500,
    })
    
    const messages = await parseLLMResponse(result)
    
    // ポストプロセス
    const processedMessages = messages.map(msg => ({
      ...msg,
      text: sanitizeText(msg.text),
    }))
    
    // リクエスト記録
    const { data: request } = await supabase
      .from('message_generation_requests')
      .insert({
        user_id: user.id,
        topic: validated.topic,
        level: validated.level,
        status: 'processing',
        provider: 'openai',
      })
      .select()
      .single()
    
    // TTS生成（並列処理）
    const audioPromises = processedMessages.map(async (msg, index) => {
      try {
        const audio = await generateSpeech({
          model: openai('tts-1'),
          voice: 'alloy',
          input: msg.text,
        })
        
        // Supabase Storageにアップロード
        const audioUrl = await uploadAudioToStorage(
          request.id,
          index + 1,
          audio
        )
        
        return { ...msg, audioUrl }
      } catch (error) {
        console.error('TTS error:', error)
        return { ...msg, audioUrl: null }
      }
    })
    
    const messagesWithAudio = await Promise.all(audioPromises)
    
    // DBに保存
    const messageRecords = await Promise.all(
      messagesWithAudio.map((msg, index) =>
        supabase.from('messages').insert({
          user_id: user.id,
          text: msg.text,
          topic: validated.topic,
          level: validated.level,
          request_id: request.id,
          sequence: index + 1,
          provider: 'openai',
        })
      )
    )
    
    // リクエスト更新
    await supabase
      .from('message_generation_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        processing_time_ms: Date.now() - startTime,
      })
      .eq('id', request.id)
    
    return {
      data: {
        requestId: request.id,
        messages: messagesWithAudio.map((msg, index) => ({
          id: messageRecords[index].data?.id || '',
          text: msg.text,
          audioUrl: msg.audioUrl,
          level: validated.level || null,
          sequence: index + 1,
          createdAt: new Date().toISOString(),
        })),
        processingTimeMs: Date.now() - startTime,
      },
    }
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }
  }
}
```

---

## 12. 変更履歴

| 日付 | バージョン | 変更内容 | 変更者 |
|------|----------|---------|--------|
| 2024-XX-XX | 1.0 | 初版作成 | - |

---

**作成日**: 2024年XX月XX日  
**最終更新日**: 2024年XX月XX日  
**承認者**: -  
**承認日**: -

