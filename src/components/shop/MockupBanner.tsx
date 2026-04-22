import Link from "next/link";

export default function MockupBanner() {
  return (
    <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <i className="fas fa-store text-lg"></i>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Demo Shop</p>
              <p className="text-sm font-black">This could be YOUR store!</p>
            </div>
          </div>
          <Link href="/register-vendor" className="bg-white text-indigo-600 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-lg flex items-center gap-2">
            <i className="fas fa-rocket"></i>
            Register Now
          </Link>
        </div>
      </div>
    </div>
  );
}