import MainViewport from "@/components/main-viewport";
import ThreeDViewport from "@/components/three-d-viewport";
import ElevationViewport from "@/components/elevation-viewport";
import { RoofBuilderProvider } from "@/store/RoofBuilderContext";

export default function Home() {
  return (
    <RoofBuilderProvider>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '1rem',
          height: '100vh',
          padding: '1rem',
        }}
      >
        <MainViewport />
        <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '1rem' }}>
          <ThreeDViewport />
          <ElevationViewport />
        </div>
      </div>
    </RoofBuilderProvider>
  );
}
