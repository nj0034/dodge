import './styles.css';

const overlay = document.querySelector<HTMLDivElement>('#overlay');

if (!overlay) {
  throw new Error('Missing #overlay element');
}

overlay.innerHTML = `
  <div class="panel">
    <p class="eyebrow">DODGE</p>
    <h1>닷지</h1>
    <p>방향키로 우주선을 조종해서 사방에서 몰려오는 총알을 피하세요.</p>
    <button type="button" class="primary">Start</button>
  </div>
`;
