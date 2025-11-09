import { Metadata } from 'next'
import { SignUpForm } from '@/app/components/auth/SignUpForm'

export const metadata: Metadata = {
  title: '新規登録 | 英語学習チャット',
  description: '新規アカウントを作成して英語学習を始めましょう',
}

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-black sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-black dark:text-zinc-50">
            英語学習チャット
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            新規アカウントを作成
          </p>
        </div>
        <SignUpForm />
      </div>
    </div>
  )
}

