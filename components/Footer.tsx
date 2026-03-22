import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-zinc-950 border-t border-fresh-sky-100 dark:border-zinc-800 pt-10 pb-8 mt-12 w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex items-center space-x-2">
            <Image 
              src="/favicon.png" 
              alt="GeMTenders.org Logo" 
              width={32} 
              height={32} 
              className="object-contain"
            />
            <span className="font-bricolage text-lg font-black text-fresh-sky-950 dark:text-white tracking-tight">
              GeMTenders.org
            </span>
          </div>
          
          <div className="flex space-x-6 text-sm">
            <Link 
              href="/about" 
              className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-bold transition-colors"
            >
              About
            </Link>
            <Link 
              href="/privacy" 
              className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-bold transition-colors"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
        
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-zinc-800 text-center flex flex-col items-center">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            &copy; {new Date().getFullYear()} GeMTenders.org. Data sourced from Government e-Marketplace (gem.gov.in). GeMTenders.org is not affiliated with the Government of India.
          </p>
        </div>
      </div>
    </footer>
  );
}
