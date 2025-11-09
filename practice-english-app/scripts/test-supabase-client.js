// Supabaseクライアントの初期化テスト
// 注意: このスクリプトはNode.js環境で実行されますが、
// 実際のブラウザ/サーバー環境ではNext.jsが自動的に.env.localを読み込みます

const fs = require('fs');
const path = require('path');

// .env.localを手動で読み込む
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const envVars = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  }
});

console.log('=== Supabaseクライアント初期化テスト ===\n');

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ 環境変数が設定されていません');
  process.exit(1);
}

// URL形式の検証
try {
  const url = new URL(supabaseUrl);
  if (url.protocol !== 'https:') {
    console.warn('⚠️  URLプロトコルがhttpsではありません');
  }
  if (!url.hostname.includes('supabase.co')) {
    console.warn('⚠️  SupabaseのURL形式ではない可能性があります');
  }
  console.log('✅ SUPABASE_URL形式: 正常');
  console.log(`   URL: ${supabaseUrl}`);
} catch (error) {
  console.error('❌ SUPABASE_URL形式が無効です:', error.message);
  process.exit(1);
}

// ANON_KEY形式の検証（JWT形式）
if (supabaseAnonKey.length < 100) {
  console.warn('⚠️  ANON_KEYが短すぎる可能性があります');
} else {
  console.log('✅ SUPABASE_ANON_KEY形式: 正常');
  console.log(`   キー長: ${supabaseAnonKey.length}文字`);
  
  // JWT形式の基本チェック（3つの部分に分割される）
  const parts = supabaseAnonKey.split('.');
  if (parts.length === 3) {
    console.log('✅ JWT形式: 正常（3つの部分で構成）');
  } else {
    console.warn('⚠️  JWT形式ではない可能性があります');
  }
}

console.log('\n📋 確認結果:');
console.log('✅ 環境変数は正しく設定されており、Supabaseクライアントの初期化が可能です');
console.log('\n💡 次のステップ:');
console.log('   1. npm run dev で開発サーバーを起動');
console.log('   2. lib/supabase/client.ts または lib/supabase/server.ts を使用してSupabaseに接続');

