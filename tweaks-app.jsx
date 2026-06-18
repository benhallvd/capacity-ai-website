/* Capacity landing — Tweaks panel (React island).
   Drives hero direction + accent via window.applyCapacityTweaks (vanilla). */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "headline": "platform",
  "accent": "#1b63f8",
  "motion": true
}/*EDITMODE-END*/;

function CapacityTweaks() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => {
    if (window.applyCapacityTweaks) window.applyCapacityTweaks(t);
  }, [t]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Hero" />
      <TweakRadio
        label="Headline"
        value={t.headline}
        options={[{ value: 'platform', label: 'Platform' }, { value: 'fill', label: 'Fill venue' }]}
        onChange={(v) => setTweak('headline', v)}
      />
      <TweakSection label="Brand" />
      <TweakColor
        label="Accent"
        value={t.accent}
        options={['#1b63f8', '#21c0e9', '#9180ff', '#e27555']}
        onChange={(v) => setTweak('accent', v)}
      />
      <TweakSection label="Motion" />
      <TweakToggle label="Smooth scrolling" value={t.motion} onChange={(v) => setTweak('motion', v)} />
    </TweaksPanel>
  );
}

(function mountTweaks() {
  const root = document.getElementById('tweaks-root');
  if (!root || !window.ReactDOM) return;
  // Apply persisted defaults immediately on load (host keeps the block current)
  if (window.applyCapacityTweaks) window.applyCapacityTweaks(TWEAK_DEFAULTS);
  ReactDOM.createRoot(root).render(<CapacityTweaks />);
})();
