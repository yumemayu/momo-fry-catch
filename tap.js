const playArea = document.querySelector('#field, #cats, #scene');
const reduceTapMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
playArea?.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  const sparkle = document.createElement('span');
  sparkle.className = 'tap-sparkle';
  sparkle.setAttribute('aria-hidden', 'true');
  sparkle.textContent = '✦';
  sparkle.style.left = event.clientX + 'px';
  sparkle.style.top = event.clientY + 'px';
  document.body.append(sparkle);
  const animation = sparkle.animate(reduceTapMotion.matches
    ? [{ opacity: 1 }, { opacity: 0 }]
    : [{ opacity: 1, transform: 'translate(-50%, -50%) scale(.65)' },
      { opacity: 0, transform: 'translate(-50%, -105%) scale(1.4)' }],
    { duration: reduceTapMotion.matches ? 180 : 430, easing: 'ease-out' });
  animation.onfinish = () => sparkle.remove();
});
