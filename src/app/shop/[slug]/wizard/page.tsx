import WizardClient from "./WizardClient";

export default async function WizardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <WizardClient slug={slug} />;
}
