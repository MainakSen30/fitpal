type FeatureIntroProps = {
  index: string;
  title: string;
  body: string;
  layout?: "stacked" | "split" | "centered";
};

function Eyebrow({ index, centered = false }: { index: string; centered?: boolean }) {
  return (
    <div className={`type-eyebrow ${centered ? "justify-center" : ""}`}>
      <span>Feature</span>
      <span aria-hidden="true">/</span>
      <span>{index}</span>
    </div>
  );
}

export function FeatureIntro({ index, title, body, layout = "stacked" }: FeatureIntroProps) {
  if (layout === "split") {
    return (
      <div className="grid gap-8 lg:grid-cols-12 lg:items-end lg:gap-16">
        <div className="lg:col-span-7">
          <Eyebrow index={index} />
          <h1 className="type-display mt-5">{title}</h1>
        </div>
        <p className="type-body-lg max-w-md lg:col-span-5 lg:pb-2">{body}</p>
      </div>
    );
  }

  if (layout === "centered") {
    return (
      <div className="text-center">
        <Eyebrow index={index} centered />
        <h1 className="type-display mx-auto mt-5 max-w-3xl">{title}</h1>
        <p className="type-body-lg mx-auto mt-6 max-w-xl">{body}</p>
      </div>
    );
  }

  return (
    <div>
      <Eyebrow index={index} />
      <h1 className="type-display mt-5 max-w-xl">{title}</h1>
      <p className="type-body-lg mt-6 max-w-xl">{body}</p>
    </div>
  );
}
