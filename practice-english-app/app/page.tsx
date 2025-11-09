import { createClient } from '@/lib/supabase/server'
import { HomeContent } from '@/app/components/home/HomeContent'

export default async function Home({
  searchParams,
}: {
  searchParams: { signup?: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-black sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-black dark:text-zinc-50">
            英語学習チャット
          </h1>
          <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">
            AIと一緒に英語を学ぼう
          </p>
        </div>

        <HomeContent user={user} showSignupSuccess={searchParams.signup === 'success'} />
      </div>
    </div>
  )
}
