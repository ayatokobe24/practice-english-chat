// 環境変数の確認スクリプト
// Next.jsは自動的に.env.localを読み込むため、このスクリプトは直接ファイルを読み込む

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');

console.log('=== 環境変数確認 ===\n');

if (!fs.existsSync(envPath)) {
  console.error('❌ .env.localファイルが見つかりません');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));

console.log('📄 .env.localファイルの内容:');
console.log('─'.repeat(50));

let hasUrl = false;
let hasKey = false;

lines.forEach(line => {
  const trimmed = line.trim();
  if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    const value = trimmed.split('=')[1]?.trim();
    if (value && value !== 'your-project-url') {
      hasUrl = true;
      console.log(`✅ NEXT_PUBLIC_SUPABASE_URL: ${value.substring(0, 40)}...`);
    } else {
      console.log(`❌ NEXT_PUBLIC_SUPABASE_URL: 未設定またはデフォルト値`);
    }
  } else if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
    const value = trimmed.split('=')[1]?.trim();
    if (value && value !== 'your-anon-key') {
      hasKey = true;
      console.log(`✅ NEXT_PUBLIC_SUPABASE_ANON_KEY: 設定済み (${value.length}文字)`);
    } else {
      console.log(`❌ NEXT_PUBLIC_SUPABASE_ANON_KEY: 未設定またはデフォルト値`);
    }
  }
});

console.log('─'.repeat(50));
console.log('\n📋 確認結果:');

if (hasUrl && hasKey) {
  console.log('✅ すべての環境変数が正しく設定されています！');
  console.log('\n次のステップ:');
  console.log('  npm run dev を実行して開発サーバーを起動してください');
  process.exit(0);
} else {
  console.log('❌ 環境変数の設定に問題があります');
  if (!hasUrl) console.log('  - NEXT_PUBLIC_SUPABASE_URL が設定されていません');
  if (!hasKey) console.log('  - NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません');
  process.exit(1);
}

