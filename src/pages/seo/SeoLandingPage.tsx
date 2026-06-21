import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, MapPin, Recycle, ShieldCheck } from "lucide-react";

export interface SeoPageProps {
  title: string;
  metaDescription: string;
  h1: string;
  intro: string;
  bullets: string[];
  cta: { label: string; to: string };
  category?: string;
  schemaType?: "ItemList" | "LocalBusiness" | "Service";
}

export default function SeoLandingPage({
  title,
  metaDescription,
  h1,
  intro,
  bullets,
  cta,
  category,
  schemaType = "Service",
}: SeoPageProps) {
  useEffect(() => {
    document.title = title;
    const setMeta = (name: string, content: string, attr: "name" | "property" = "name") => {
      let tag = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute(attr, name);
        document.head.appendChild(tag);
      }
      tag.content = content;
    };
    setMeta("description", metaDescription);
    setMeta("og:title", title, "property");
    setMeta("og:description", metaDescription, "property");
    setMeta("og:type", "website", "property");

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = window.location.pathname;

    const ld = {
      "@context": "https://schema.org",
      "@type": schemaType,
      name: h1,
      description: metaDescription,
      areaServed: { "@type": "City", name: "Sydney" },
      provider: { "@type": "Organization", name: "Offcutt" },
    };
    let script = document.getElementById("ld-json") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = "ld-json";
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.text = JSON.stringify(ld);
  }, [title, metaDescription, h1, schemaType]);

  const browseUrl = category ? `/marketplace?category=${category}` : "/marketplace";

  return (
    <Layout>
      <section className="bg-secondary text-secondary-foreground py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-2 text-primary mb-4">
            <MapPin className="h-4 w-4" />
            <span className="text-sm font-medium uppercase tracking-wider">Sydney, Australia</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">{h1}</h1>
          <p className="text-lg text-secondary-foreground/80 mb-8 leading-relaxed">{intro}</p>
          <div className="flex flex-wrap gap-4">
            <Button size="xl" asChild>
              <Link to={browseUrl}>{cta.label}<ArrowRight className="ml-2 h-5 w-5" /></Link>
            </Button>
            <Button size="xl" variant="hero-outline" asChild>
              <Link to="/how-it-works">How it works</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl font-bold mb-8">Why Sydney builders choose Offcutt</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {bullets.map((b, i) => (
              <Card key={i} className="p-5 flex gap-3 items-start">
                <Recycle className="h-5 w-5 text-primary mt-1 shrink-0" />
                <p className="text-foreground">{b}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <ShieldCheck className="h-10 w-10 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Built for Sydney's construction industry</h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Every listing includes pickup location, condition, and seller verification. Divert
            materials from landfill and save on your next project.
          </p>
          <Button size="xl" asChild>
            <Link to={browseUrl}>{cta.label}</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}