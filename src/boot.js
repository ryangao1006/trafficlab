const status = document.getElementById('boot-status');
const error = document.getElementById('boot-error');
let chinese = false;
try { chinese = localStorage.getItem('trafficlab.language') === 'zh'; } catch {}
if (chinese) {
  status.textContent = '正在加载 TrafficLab…';
  error.textContent = 'TrafficLab 加载失败。';
  document.getElementById('boot-retry').textContent = '重试';
}
import('./app.js').then(() => {
  document.getElementById('boot').hidden = true;
  document.body.classList.remove('booting');
}).catch(cause => {
  console.error('TrafficLab could not start', cause);
  status.hidden = true;
  document.getElementById('boot-failure').hidden = false;
});
