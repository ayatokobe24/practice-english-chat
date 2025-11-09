'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'

interface HomeContentProps {
  user: User | null
  showSignupSuccess: boolean
}

export function HomeContent({ user, showSignupSuccess }: HomeContentProps) {
  const [showSuccess, setShowSuccess] = useState(showSignupSuccess)

  useEffect(() => {
    if (showSignupSuccess) {
      // 5秒後に成功メッセージを非表示
      const timer = setTimeout(() => {
        setShowSuccess(false)
        // URLからクエリパラメータを削除
        window.history.replaceState({}, '', '/')
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [showSignupSuccess])

  if (user) {
    // ログイン済みの場合
    return (
      <div className="space-y-6">
        {showSuccess && (
          <div
            className="rounded-md bg-green-50 p-4 dark:bg-green-900/20"
            role="alert"
          >
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              ✅ 登録が完了しました！ようこそ、{user.email}さん
            </p>
          </div>
        )}

        <div className="rounded-lg bg-white px-6 py-8 shadow-md dark:bg-zinc-900">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
                ようこそ、{user.email}さん
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                英語学習を始めましょう
              </p>
            </div>

            <div className="space-y-3">
              <Link
                href="/"
                className="block w-full rounded-md bg-blue-600 px-4 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                学習を始める
              </Link>

              <Link
                href="/bookmarks"
                className="block w-full rounded-md border border-zinc-300 bg-white px-4 py-3 text-center text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                ブックマーク一覧
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 未ログインの場合
  return (
    <div className="space-y-6">
      {showSuccess && (
        <div
          className="rounded-md bg-green-50 p-4 dark:bg-green-900/20"
          role="alert"
        >
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            ✅ 登録が完了しました！ログインして学習を始めましょう
          </p>
        </div>
      )}

      <div className="rounded-lg bg-white px-6 py-8 shadow-md dark:bg-zinc-900">
        <div className="space-y-4">
          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            英語学習を始めるには、アカウントが必要です
          </p>

          <div className="space-y-3">
            <Link
              href="/auth/signup"
              className="block w-full rounded-md bg-blue-600 px-4 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              新規登録
            </Link>

            <Link
              href="/auth/login"
              className="block w-full rounded-md border border-zinc-300 bg-white px-4 py-3 text-center text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              ログイン
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

