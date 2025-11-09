'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export function SignUpForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const validateForm = (): boolean => {
    setError(null)

    if (!email) {
      setError('メールアドレスを入力してください')
      return false
    }

    if (!email.includes('@')) {
      setError('有効なメールアドレスを入力してください')
      return false
    }

    if (!password) {
      setError('パスワードを入力してください')
      return false
    }

    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください')
      return false
    }

    if (password !== confirmPassword) {
      setError('パスワードが一致しません')
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()

      // 環境変数の確認（デバッグ用）
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error('Supabase環境変数が設定されていません。.env.localファイルを確認してください。')
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (signUpError) {
        console.error('Sign up error:', signUpError)
        setError(signUpError.message || '登録に失敗しました')
        setIsLoading(false)
        return
      }

      if (data.user) {
        // 登録成功
        // メール確認が必要な場合は、確認メッセージを表示
        if (data.user.email_confirmed_at === null) {
          setError(
            '確認メールを送信しました。メール内のリンクをクリックしてアカウントを有効化してください。'
          )
          setIsLoading(false)
        } else {
          // メール確認が不要な場合、成功メッセージ付きでホームへリダイレクト
          router.push('/?signup=success')
          router.refresh()
        }
      } else {
        setError('ユーザー情報の取得に失敗しました')
        setIsLoading(false)
      }
    } catch (err) {
      console.error('Sign up error:', err)
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました')
      setIsLoading(false)
    }
  }

  return (
    <div className="rounded-lg bg-white px-6 py-8 shadow-md dark:bg-zinc-900">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            disabled={isLoading}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm placeholder-zinc-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            placeholder="example@email.com"
            aria-label="メールアドレス"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            パスワード
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            disabled={isLoading}
            minLength={6}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm placeholder-zinc-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            placeholder="6文字以上"
            aria-label="パスワード"
          />
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            パスワード（確認）
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            disabled={isLoading}
            minLength={6}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm placeholder-zinc-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            placeholder="パスワードを再入力"
            aria-label="パスワード確認"
          />
        </div>

        {error && (
          <div
            className="rounded-md bg-red-50 p-4 dark:bg-red-900/20"
            role="alert"
          >
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {isLoading ? '登録中...' : '新規登録'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          すでにアカウントをお持ちですか？{' '}
          <Link
            href="/auth/login"
            className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            ログイン
          </Link>
        </p>
      </div>
    </div>
  )
}

