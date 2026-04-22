import Link from "next/link";

type BlockScreenProps = {
  message: string;
  icon: string;
  iconBg: string;
};

export default function BlockScreen({ message, icon, iconBg }: BlockScreenProps) {
  return (
    <div className="fixed inset-0 bg-[#062c24]/95 backdrop-blur-md z-[100] flex items-center justify-center p-8 text-center">
      <div>
        <div className={`w-20 h-20 ${iconBg} rounded-full flex items-center justify-center mx-auto mb-6 text-3xl`}>
          <i className={`fas ${icon}`}></i>
        </div>
        <h2 className="text-white text-3xl font-black uppercase mb-2">{message}</h2>
        <Link href="/directory" className="inline-block bg-white text-[#062c24] px-8 py-4 rounded-2xl font-black uppercase text-xs mt-4">Back</Link>
      </div>
    </div>
  );
}