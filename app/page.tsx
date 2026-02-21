import ArrowDotsButton from "../components/ArrowDotsButton";
import AnimatedArrowButton from "../components/AnimatedArrowButton";
import DirectionAwareHoverCard from "../components/DirectionAwareHoverCard";
import HamburgerMorphButton from "../components/HamburgerMorphButton";
import NavigationMenu4 from "../components/NavigationMenu4";
import NextJsShopButton from "../components/NextJsShopButton";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        padding: "2rem"
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto 2rem",
          border: "1px solid #e5e7eb",
          borderRadius: "0.75rem"
        }}
      >
        <NavigationMenu4 />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "2rem"
        }}
      >
        <ArrowDotsButton href="#" label="Arrow-Dots" />
        <AnimatedArrowButton href="#" text="Nothing-Plop" />
        <AnimatedArrowButton href="#" text="Nothing-Plop" arrowVariant="tilted45" />
        <NextJsShopButton href="#" label="Nextjsshop" />
        <HamburgerMorphButton />
        <DirectionAwareHoverCard />
      </div>
    </main>
  );
}
