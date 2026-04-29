import { useNews } from '@/hooks/useNews';

export default function NewsPage() {
  const { data: news, isLoading } = useNews();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Noticias</h1>
      {isLoading ? (
        <div>Cargando noticias...</div>
      ) : (
        <div className="flex flex-col gap-4">
          {(news ?? []).map(item => (
            <div key={item.id} className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-2">
                <h2 className="font-semibold text-gray-800 text-base">{item.title}</h2>
                <span className="text-xs text-gray-400 ml-4 whitespace-nowrap">{item.date}</span>
              </div>
              <p className="text-sm text-gray-600">{item.excerpt}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
