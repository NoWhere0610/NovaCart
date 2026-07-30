import BackButton from '../components/BackButton'

interface PolicyPageProps {
  title: string
  sections: { heading: string; body: string }[]
}

export default function PolicyPage({ title, sections }: PolicyPageProps) {
  return (
    <div className="min-h-screen bg-stone-50 px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <BackButton />
        <h1 className="text-2xl font-semibold text-stone-900 mb-8">{title}</h1>

        <div className="space-y-6">
          {sections.map((s) => (
            <div key={s.heading}>
              <h2 className="text-base font-semibold text-stone-900 mb-2">{s.heading}</h2>
              <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-line">{s.body}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-stone-400 mt-10">
          Mọi thắc mắc vui lòng liên hệ NovaCart qua hotline 0327 990 059 hoặc email nemcsb@gmail.com.
        </p>
      </div>
    </div>
  )
}