import Image from "next/image";
import Spotlight from "@/components/spotlight";

export default function Team() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="py-12 md:py-20">
          {/* Hero Section */}
          <div className="mx-auto max-w-3xl pb-12 text-center md:pb-20">
            <div className="inline-flex items-center gap-3 pb-3 before:h-px before:w-8 before:bg-linear-to-r before:from-transparent before:to-indigo-200/50 after:h-px after:w-8 after:bg-linear-to-l after:from-transparent after:to-indigo-200/50">
              <span className="inline-flex bg-linear-to-r from-indigo-500 to-indigo-200 bg-clip-text text-transparent">
                关于我们
              </span>
            </div>
            <h1 className="animate-[gradient_6s_linear_infinite] bg-[linear-gradient(to_right,var(--color-gray-200),var(--color-indigo-200),var(--color-gray-50),var(--color-indigo-300),var(--color-gray-200))] bg-[length:200%_auto] bg-clip-text pb-5 font-nacelle text-4xl font-semibold text-transparent md:text-5xl">
              团队介绍
            </h1>
            <p className="text-lg text-indigo-200/65">
              FidesOrigin 由一群深耕金融科技和 Web3 领域的连续创业者创立，
              <br className="hidden md:block" />
              致力于构建链上合规的基础设施未来。
            </p>
          </div>

          {/* Team Members */}
          <Spotlight className="group mx-auto grid max-w-sm items-start gap-8 lg:max-w-none lg:grid-cols-2">
            {/* Wesley - CEO */}
            <div
              className="group/card relative h-full overflow-hidden rounded-2xl bg-gray-800 p-px before:pointer-events-none before:absolute before:-left-40 before:-top-40 before:z-10 before:h-80 before:w-80 before:translate-x-[var(--mouse-x)] before:translate-y-[var(--mouse-y)] before:rounded-full before:bg-indigo-500/80 before:opacity-0 before:blur-3xl before:transition-opacity before:duration-500 after:pointer-events-none after:absolute after:-left-48 after:-top-48 after:z-30 after:h-64 after:w-64 after:translate-x-[var(--mouse-x)] after:translate-y-[var(--mouse-y)] after:rounded-full after:bg-indigo-500 after:opacity-0 after:blur-3xl after:transition-opacity after:duration-500 hover:after:opacity-20 group-hover:before:opacity-100"
            >
              <div className="relative z-20 h-full overflow-hidden rounded-[inherit] bg-gray-950 after:absolute after:inset-0 after:bg-linear-to-br after:from-gray-900/50 after:via-gray-800/25 after:to-gray-900/50">
                <div className="p-8">
                  {/* Avatar Placeholder */}
                  <div className="mb-6 flex items-center gap-6">
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-linear-to-br from-indigo-500/20 to-indigo-600/10 ring-2 ring-indigo-500/30">
                      <span className="text-3xl font-bold text-indigo-300">W</span>
                    </div>
                    <div>
                      <h3 className="font-nacelle text-2xl font-semibold text-gray-200">
                        Wesley
                      </h3>
                      <p className="text-indigo-200/65">杨鸿威</p>
                      <div className="mt-2">
                        <span className="btn-sm relative rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-normal text-indigo-300 before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:border before:border-transparent before:[background:linear-gradient(to_bottom,--theme(--color-indigo-500/.15),--theme(--color-indigo-500/.5))_border-box] before:[mask-composite:exclude_!important] before:[mask:linear-gradient(white_0_0)_padding-box,_linear-gradient(white_0_0)]">
                          创始人 & CEO
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Bio */}
                  <div className="space-y-4">
                    <p className="text-indigo-200/80 leading-relaxed">
                      深耕金融科技与 Web3 领域超过 8 年，拥有丰富的产品管理与合规经验。
                    </p>
                    
                    {/* Experience */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-start gap-3">
                        <div className="mt-1.5 h-2 w-2 rounded-full bg-indigo-500"></div>
                        <div>
                          <p className="text-gray-200 font-medium">富途牛牛</p>
                          <p className="text-sm text-indigo-200/60">Web3 产品负责人，主导香港稳定币牌照申请与机构级 Crypto 支付基础设施建设</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="mt-1.5 h-2 w-2 rounded-full bg-indigo-500"></div>
                        <div>
                          <p className="text-gray-200 font-medium">腾讯</p>
                          <p className="text-sm text-indigo-200/60">微信支付 P10 产品经理，负责国内支付平台及渠道业务</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="mt-1.5 h-2 w-2 rounded-full bg-indigo-500"></div>
                        <div>
                          <p className="text-gray-200 font-medium">字节跳动</p>
                          <p className="text-sm text-indigo-200/60">财经部门 3-1 产品专家，负责跨境支付业务</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Rex - CTO */}
            <div
              className="group/card relative h-full overflow-hidden rounded-2xl bg-gray-800 p-px before:pointer-events-none before:absolute before:-left-40 before:-top-40 before:z-10 before:h-80 before:w-80 before:translate-x-[var(--mouse-x)] before:translate-y-[var(--mouse-y)] before:rounded-full before:bg-indigo-500/80 before:opacity-0 before:blur-3xl before:transition-opacity before:duration-500 after:pointer-events-none after:absolute after:-left-48 after:-top-48 after:z-30 after:h-64 after:w-64 after:translate-x-[var(--mouse-x)] after:translate-y-[var(--mouse-y)] after:rounded-full after:bg-indigo-500 after:opacity-0 after:blur-3xl after:transition-opacity after:duration-500 hover:after:opacity-20 group-hover:before:opacity-100"
            >
              <div className="relative z-20 h-full overflow-hidden rounded-[inherit] bg-gray-950 after:absolute after:inset-0 after:bg-linear-to-br after:from-gray-900/50 after:via-gray-800/25 after:to-gray-900/50">
                <div className="p-8">
                  {/* Avatar Placeholder */}
                  <div className="mb-6 flex items-center gap-6">
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-linear-to-br from-indigo-500/20 to-indigo-600/10 ring-2 ring-indigo-500/30">
                      <span className="text-3xl font-bold text-indigo-300">R</span>
                    </div>
                    <div>
                      <h3 className="font-nacelle text-2xl font-semibold text-gray-200">
                        Rex
                      </h3>
                      <p className="text-indigo-200/65">李逸超</p>
                      <div className="mt-2">
                        <span className="btn-sm relative rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-normal text-indigo-300 before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:border before:border-transparent before:[background:linear-gradient(to_bottom,--theme(--color-indigo-500/.15),--theme(--color-indigo-500/.5))_border-box] before:[mask-composite:exclude_!important] before:[mask:linear-gradient(white_0_0)_padding-box,_linear-gradient(white_0_0)]">
                          联合创始人 & CTO
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Bio */}
                  <div className="space-y-4">
                    <p className="text-indigo-200/80 leading-relaxed">
                      资深 Web3 产品专家与连续创业者，在加密货币基础设施和稳定币领域拥有深厚积累。
                    </p>
                    
                    {/* Experience */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-start gap-3">
                        <div className="mt-1.5 h-2 w-2 rounded-full bg-indigo-500"></div>
                        <div>
                          <p className="text-gray-200 font-medium">富途牛牛</p>
                          <p className="text-sm text-indigo-200/60">稳定币产品 CPO，主导合规稳定币发行系统设计与机构支付解决方案</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="mt-1.5 h-2 w-2 rounded-full bg-indigo-500"></div>
                        <div>
                          <p className="text-gray-200 font-medium">Cobo</p>
                          <p className="text-sm text-indigo-200/60">产品总监，负责机构级数字资产托管与钱包基础设施产品</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="mt-1.5 h-2 w-2 rounded-full bg-indigo-500"></div>
                        <div>
                          <p className="text-gray-200 font-medium">连续创业者</p>
                          <p className="text-sm text-indigo-200/60">多次 Web3 创业经历，深耕区块链技术与产品落地</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Spotlight>

          {/* Advisors & Partners Section */}
          <div className="mx-auto max-w-3xl pt-20 pb-12 text-center">
            <div className="inline-flex items-center gap-3 pb-3 before:h-px before:w-8 before:bg-linear-to-r before:from-transparent before:to-indigo-200/50 after:h-px after:w-8 after:bg-linear-to-l after:from-transparent after:to-indigo-200/50">
              <span className="inline-flex bg-linear-to-r from-indigo-500 to-indigo-200 bg-clip-text text-transparent">
                生态伙伴
              </span>
            </div>
            <h2 className="animate-[gradient_6s_linear_infinite] bg-[linear-gradient(to_right,var(--color-gray-200),var(--color-indigo-200),var(--color-gray-50),var(--color-indigo-300),var(--color-gray-200))] bg-[length:200%_auto] bg-clip-text pb-4 font-nacelle text-3xl font-semibold text-transparent md:text-4xl">
              顾问与合作伙伴
            </h2>
            <p className="text-lg text-indigo-200/65 mb-12">
              我们正在与行业顶尖的合规机构和技术伙伴建立合作，共同推进链上合规基础设施建设。
            </p>
          </div>

          {/* Partner Cards */}
          <div className="mx-auto grid max-w-sm items-start gap-6 lg:max-w-none lg:grid-cols-3">
            {/* Advisor Card 1 */}
            <div className="relative h-full overflow-hidden rounded-2xl border border-indigo-500/20 bg-gray-900/50 p-8">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-800/50">
                  <svg className="h-8 w-8 text-indigo-500/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                <h3 className="mb-2 font-nacelle text-lg font-semibold text-gray-300">
                  战略顾问
                </h3>
                <p className="text-sm text-indigo-200/50">
                  即将公布
                </p>
              </div>
            </div>

            {/* Partner Card 1 */}
            <div className="relative h-full overflow-hidden rounded-2xl border border-indigo-500/20 bg-gray-900/50 p-8">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-800/50">
                  <svg className="h-8 w-8 text-indigo-500/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                  </svg>
                </div>
                <h3 className="mb-2 font-nacelle text-lg font-semibold text-gray-300">
                  技术合作伙伴
                </h3>
                <p className="text-sm text-indigo-200/50">
                  即将公布
                </p>
              </div>
            </div>

            {/* Partner Card 2 */}
            <div className="relative h-full overflow-hidden rounded-2xl border border-indigo-500/20 bg-gray-900/50 p-8">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-800/50">
                  <svg className="h-8 w-8 text-indigo-500/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <h3 className="mb-2 font-nacelle text-lg font-semibold text-gray-300">
                  合规合作伙伴
                </h3>
                <p className="text-sm text-indigo-200/50">
                  即将公布
                </p>
              </div>
            </div>
          </div>

          {/* Join Us CTA */}
          <div className="mx-auto max-w-2xl pt-16 text-center">
            <div className="rounded-2xl bg-linear-to-br from-indigo-900/20 to-gray-900/50 p-8 ring-1 ring-indigo-500/20">
              <h3 className="mb-3 font-nacelle text-xl font-semibold text-gray-200">
                加入我们
              </h3>
              <p className="mb-6 text-indigo-200/65">
                我们正在寻找对链上合规和 RWA 代币化充满热情的工程师、产品经理和运营人才。
              </p>
              <a
                href="mailto:contact@fidesorigin.com"
                className="btn group inline-flex items-center bg-linear-to-t from-indigo-600 to-indigo-500 bg-[length:100%_100%] bg-[bottom] px-6 py-2.5 text-white shadow-[inset_0px_1px_0px_0px_--theme(--color-white/.16)] hover:bg-[length:100%_150%]"
              >
                <span className="relative inline-flex items-center">
                  联系我们
                  <span className="ml-1 tracking-normal text-white/50 transition-transform group-hover:translate-x-0.5">
                    -&gt;
                  </span>
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
