import Link from "next/link";

type CtaAction = { label: string; href: string };

export function SiteCta({
  actions,
  id,
  className = "",
}: {
  actions: CtaAction[];
  id?: string;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-24 pb-20 lg:pb-28 ${className}`}>
      <div className="container-editorial">
        <div className="rounded-2xl border border-hairline bg-wine-800/40 px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <h2 className="type-headline">Ready to start your journey?</h2>
              <p className="type-body-lg mt-3">Download FitPal and track every rep towards your goals.</p>
            </div>
            <div className="flex flex-shrink-0 flex-col gap-3 sm:flex-row">
              {actions.map((action, index) => (
                <Link
                  key={`${action.href}-${action.label}`}
                  href={action.href}
                  className={`${index === 0 ? "button-primary" : "button-secondary"} px-6 py-3 text-sm`}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
