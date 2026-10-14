import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowRight,
  BadgeCheck,
  CarFront,
  Check,
  ChevronRight,
  FileCheck2,
  HeartPulse,
  Menu,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { LOGIN_URL } from "@/lib/site";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "InsuroX — Insurance Made Simple" },
      {
        name: "description",
        content:
          "Secure, streamlined health and motor insurance services for customers, agents, and administrators.",
      },
      { property: "og:title", content: "InsuroX — Insurance Made Simple" },
      {
        property: "og:description",
        content: "Secure, streamlined health and motor insurance services.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const plans = [
  {
    number: "01",
    title: "Health Insurance",
    description: "Thoughtful protection for your health and the people you care about most.",
    items: ["Medical protection", "Family coverage", "Flexible plans", "Secure policy management"],
    icon: HeartPulse,
    className: "plan-health",
  },
  {
    number: "02",
    title: "Motor Insurance",
    description: "Comprehensive cover designed to keep you moving with complete confidence.",
    items: ["Car protection", "Comprehensive coverage", "Easy policy management", "Fast renewal"],
    icon: CarFront,
    className: "plan-motor",
  },
];

const features = [
  {
    title: "Secure Policy Management",
    text: "Your documents and policy details stay protected and easy to reach.",
    icon: ShieldCheck,
    className: "md:col-span-2 md:row-span-2",
  },
  {
    title: "Easy Claims & Renewals",
    text: "Clear steps, fewer complications.",
    icon: FileCheck2,
    className: "md:col-span-1",
  },
  {
    title: "Trusted Agents",
    text: "Connect with support when it matters.",
    icon: UsersRound,
    className: "md:col-span-1",
  },
  {
    title: "Centralized Records",
    text: "One organized view across your insurance journey.",
    icon: BadgeCheck,
    className: "md:col-span-2",
  },
];

function MagneticLink({
  children,
  className,
  href = LOGIN_URL,
}: {
  children: ReactNode;
  className: string;
  href?: string;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const move = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = element.getBoundingClientRect();
    element.style.transform = `translate(${(event.clientX - rect.left - rect.width / 2) * 0.1}px, ${(event.clientY - rect.top - rect.height / 2) * 0.16}px)`;
  };
  return (
    <a
      ref={ref}
      href={href}
      onMouseMove={move}
      onMouseLeave={() => {
        if (ref.current) ref.current.style.transform = "translate(0, 0)";
      }}
      className={className}
    >
      {children}
    </a>
  );
}

function Index() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach(
          (entry) => entry.isIntersecting && entry.target.classList.add("is-visible"),
        ),
      { threshold: 0.12 },
    );
    document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="site-shell overflow-hidden bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex h-16 max-w-6xl items-center justify-between rounded-full border border-border/70 bg-background/80 px-4 shadow-nav backdrop-blur-xl sm:px-5"
        >
          <a href="#top" className="flex items-center gap-2.5" aria-label="InsuroX home">
            <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" />
            </span>
            <span className="font-display text-lg font-extrabold">InsuroX</span>
          </a>
          <div className="hidden items-center gap-7 lg:flex">
            {[
              ["Home", "top"],
              ["Insurance", "insurance"],
              ["About", "about"],
              ["Contact", "contact"],
            ].map(([label, id]) => (
              <a key={id} className="nav-link" href={`#${id}`}>
                {label}
              </a>
            ))}
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            <a
              href={LOGIN_URL}
              className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-5 text-sm font-medium transition-colors hover:bg-accent"
            >
              Admin / Agent Login
            </a>
            <a
              href="#insurance"
              className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Get Started
            </a>
          </div>
          <ThemeToggle className="ml-auto mr-2 rounded-full lg:ml-0 lg:mr-0" />
          <Button
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            variant="ghost"
            size="icon"
            className="rounded-full lg:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </Button>
        </nav>
        {menuOpen && (
          <div className="mx-auto mt-2 max-w-6xl rounded-3xl border border-border bg-background p-5 shadow-nav lg:hidden">
            <div className="flex flex-col gap-1">
              {[
                ["Home", "top"],
                ["Insurance", "insurance"],
                ["About", "about"],
                ["Contact", "contact"],
              ].map(([label, id]) => (
                <a
                  key={id}
                  className="rounded-xl px-4 py-3 font-medium hover:bg-muted"
                  href={`#${id}`}
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </a>
              ))}
              <a
                href={LOGIN_URL}
                className="mt-3 inline-flex h-12 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Admin / Agent Login
              </a>
            </div>
          </div>
        )}
      </header>

      <main>
        <section
          id="top"
          className="hero-field relative flex min-h-[940px] items-center pt-28 lg:min-h-[920px]"
        >
          <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-6 pb-24 pt-16 lg:grid-cols-[1.08fr_.92fr] lg:px-10">
            <div className="relative z-10">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-semibold uppercase text-muted-foreground backdrop-blur-lg">
                <Sparkles className="size-3.5 text-signal" /> Protection, made human
              </div>
              <h1 className="max-w-4xl font-display text-[clamp(3.7rem,7.7vw,7.75rem)] font-extrabold leading-[0.87] tracking-normal text-balance">
                Insurance made <span className="text-primary">simple,</span>
                <br /> secure <span className="font-light text-muted-foreground">&</span> reliable.
              </h1>
              <div className="mt-10 flex max-w-2xl flex-col gap-8 border-l border-primary/25 pl-6 sm:flex-row sm:items-end sm:justify-between">
                <p className="max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
                  Manage health and motor insurance policies with a secure, streamlined platform
                  built for customers, agents and administrators.
                </p>
                <a
                  href="#insurance"
                  aria-label="Scroll to insurance plans"
                  className="group grid size-14 shrink-0 place-items-center rounded-full border border-border bg-background transition-transform hover:scale-105 active:scale-95"
                >
                  <ArrowDownRight className="transition-transform group-hover:rotate-12" />
                </a>
              </div>
              <div className="mt-10 flex flex-wrap gap-3">
                <a href="#insurance" className="magnetic-button bg-primary text-primary-foreground">
                  Explore Insurance <ArrowRight />
                </a>
                <MagneticLink className="magnetic-button border border-border bg-background text-foreground">
                  Admin / Agent Login
                </MagneticLink>
              </div>
            </div>

            <div
              className="policy-stage relative mx-auto h-[530px] w-full max-w-[560px]"
              aria-label="Secure health and motor policy preview"
            >
              <div className="policy-card policy-card-main">
                <div className="flex items-start justify-between">
                  <span className="policy-icon">
                    <HeartPulse />
                  </span>
                  <span className="status-dot">Active Policy</span>
                </div>
                <div className="mt-auto">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Health protection
                  </p>
                  <h2 className="mt-2 font-display text-3xl font-bold">Health, covered.</h2>
                  <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-4/5 rounded-full bg-primary" />
                  </div>
                </div>
              </div>
              <div className="policy-card policy-card-car">
                <div className="flex items-start justify-between">
                  <span className="policy-icon bg-primary text-primary-foreground">
                    <CarFront />
                  </span>
                  <BadgeCheck className="text-primary" />
                </div>
                <div className="mt-auto">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Motor insurance
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-bold">Ready for the road.</h2>
                </div>
              </div>
              <div className="float-chip chip-secure">
                <ShieldCheck /> Secure
              </div>
              <div className="float-chip chip-verified">
                <BadgeCheck /> Verified
              </div>
              <div className="absolute bottom-8 left-10 size-36 rounded-full border border-primary/15" />
            </div>
          </div>
        </section>

        <section id="insurance" className="section-space bg-surface">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <div className="reveal mb-14 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <p className="eyebrow">Coverage designed around life</p>
                <h2 className="section-title max-w-3xl">
                  Insurance plans for <span className="text-muted-foreground">every need.</span>
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                Clear choices, thoughtful protection, and a simpler way to stay covered.
              </p>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              {plans.map((plan, index) => {
                const Icon = plan.icon;
                return (
                  <article
                    key={plan.title}
                    className={`reveal premium-plan ${plan.className}`}
                    style={{ transitionDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-muted-foreground">
                        {plan.number}
                      </span>
                      <span className="plan-icon">
                        <Icon />
                      </span>
                    </div>
                    <div className="mt-16 lg:mt-24">
                      <h3 className="font-display text-[clamp(2.1rem,4vw,3.7rem)] font-bold leading-none">
                        {plan.title}
                      </h3>
                      <p className="mt-5 max-w-md leading-7 text-muted-foreground">
                        {plan.description}
                      </p>
                    </div>
                    <ul className="mt-10 grid gap-3 sm:grid-cols-2">
                      {plan.items.map((item) => (
                        <li key={item} className="flex items-center gap-2 text-sm font-medium">
                          <span className="grid size-5 place-items-center rounded-full bg-background">
                            <Check className="size-3" />
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                    <a
                      href="#contact"
                      className="mt-10 inline-flex items-center gap-2 font-semibold"
                    >
                      Explore {plan.title} <ArrowRight className="size-4" />
                    </a>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="about" className="section-space">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <div className="reveal max-w-4xl">
              <p className="eyebrow">One clear system</p>
              <h2 className="section-title">
                Built for simple & secure <span className="text-primary">policy management.</span>
              </h2>
            </div>
            <div className="mt-14 grid auto-rows-[220px] gap-4 md:grid-cols-3">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <article
                    key={feature.title}
                    className={`reveal feature-tile ${feature.className}`}
                    style={{ transitionDelay: `${index * 75}ms` }}
                  >
                    <div className="flex h-full flex-col justify-between">
                      <Icon className="size-7 text-primary" />
                      <div>
                        <h3 className="font-display text-xl font-bold">{feature.title}</h3>
                        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                          {feature.text}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="section-space border-y border-border bg-surface">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <div className="reveal grid gap-8 lg:grid-cols-[.72fr_1.28fr]">
              <div>
                <p className="eyebrow">How it works</p>
                <h2 className="section-title">A clearer path to cover.</h2>
              </div>
              <ol className="divide-y divide-border border-y border-border">
                {[
                  [
                    "01",
                    "Choose Insurance",
                    "Find the health or motor protection that fits your needs.",
                  ],
                  [
                    "02",
                    "Connect With an Agent",
                    "Get clear guidance from a trusted insurance professional.",
                  ],
                  [
                    "03",
                    "Manage Your Policy",
                    "Keep policy details and services organized in one place.",
                  ],
                ].map(([n, title, text]) => (
                  <li
                    key={n}
                    className="group grid gap-4 py-7 sm:grid-cols-[60px_1fr_auto] sm:items-center"
                  >
                    <span className="text-xs font-semibold text-muted-foreground">{n}</span>
                    <div>
                      <h3 className="font-display text-xl font-bold">{title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                    </div>
                    <ChevronRight className="hidden transition-transform group-hover:translate-x-1 sm:block" />
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section id="contact" className="px-4 py-5 sm:px-6 sm:py-6">
          <div className="reveal cta-panel mx-auto max-w-[1500px] overflow-hidden rounded-[2rem] px-6 py-20 text-primary-foreground sm:px-12 lg:px-20 lg:py-28">
            <div className="relative z-10 max-w-4xl">
              <p className="eyebrow text-primary-foreground/60">
                Your policies. Your peace of mind.
              </p>
              <h2 className="font-display text-[clamp(3rem,7vw,6.8rem)] font-extrabold leading-[.92]">
                Ready to manage your insurance?
              </h2>
              <p className="mt-7 max-w-xl text-primary-foreground/70">
                Access your insurance services through our secure platform.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <a href="#insurance" className="magnetic-button bg-signal text-signal-foreground">
                  Get Started <ArrowRight />
                </a>
                <MagneticLink className="magnetic-button border border-primary-foreground/20 text-primary-foreground">
                  Admin / Agent Login
                </MagneticLink>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-6 pb-8 pt-16 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 border-b border-border pb-14 md:grid-cols-[1fr_auto]">
          <div>
            <a
              href="#top"
              className="flex items-center gap-2.5 font-display text-xl font-extrabold"
            >
              <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground">
                <ShieldCheck className="size-5" />
              </span>
              InsuroX
            </a>
            <p className="mt-5 max-w-sm text-sm leading-6 text-muted-foreground">
              Simple, secure health and motor insurance management for modern life.
            </p>
          </div>
          <nav aria-label="Footer navigation" className="grid grid-cols-2 gap-x-16 gap-y-3 text-sm">
            <a href="#top">Home</a>
            <a href="#insurance">Insurance</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
            <a href={LOGIN_URL}>Login</a>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
          </nav>
        </div>
        <div className="mx-auto flex max-w-7xl flex-col gap-2 pt-6 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p>© 2026 InsuroX. All rights reserved.</p>
          <p>Protection with clarity.</p>
        </div>
      </footer>
    </div>
  );
}
