// --- Configurações ---
const transferTypes = {
  imposto:   { color: '#e74c3c', label: 'Imposto' },
  salario:   { color: '#27ae60', label: 'Salário' },
  comercio:  { color: '#2980b9', label: 'Comércio' },
  consumo:  { color: '#123456', label: 'Consumo' },
  compra:  { color: '#ADD8E6', label: 'Compra' },
  emprestimo:{ color: '#FFFF00', label: 'Empréstimo' },
  financiamento:{ color: '#FFDBBB', label: 'Financiamento' },
};

// --- Stage & Layer ---
const containerElem = document.getElementById('container');
let stage = null;
let layer = null;
let legendGroup = null;
let activeTransfers = [];
let entitiesData = [];
let currentDay = 0;
let isPlaying = false;
let dayInterval = null;

function getStageDimensions() {
  const width = containerElem ? containerElem.clientWidth : 1200;
  const height = Math.max(480, window.innerHeight - 170);
  return { width, height };
}

function createStage() {
  if (!containerElem) return;
  const dims = getStageDimensions();
  stage = new Konva.Stage({
    container: 'container',
    width: dims.width,
    height: dims.height,
  });
  layer = new Konva.Layer();
  stage.add(layer);
}

function resizeStage() {
  if (!containerElem || !stage) return;
  const dims = getStageDimensions();
  stage.width(dims.width);
  stage.height(dims.height);
  createLegendKonva();
  if (layer) layer.batchDraw();
}

window.addEventListener('resize', () => {
  resizeStage();
});

// --- Helpers ---
function updateLabel(entity) {
  // atualiza texto e centraliza embaixo da imagem
  entity.label.text(`${entity.name}\nSaldo: R$ ${entity.saldo}`);
  // recalcula offset para centralizar horizontalmente
  entity.label.offsetX(entity.label.width() / 2);
  entity.label.x(entity.node.x());
  entity.label.y(entity.node.y() + (entity.node.height() / 2) + 8);
}

function createEntity(src, x, y, name, saldo = 1000, w = 80, h = 80) {
  const entity = { name, saldo, imgSrc: src, pos: { x, y }, width: w, height: h };
  const imageObj = new Image();
  imageObj.src = src;
  imageObj.onload = function () {
    const img = new Konva.Image({
      x,
      y,
      image: imageObj,
      width: w,
      height: h,
      offsetX: w / 2,
      offsetY: h / 2,
      draggable: true,
    });
    layer.add(img);
    entity.node = img;

    const label = new Konva.Text({
      x,
      y: y + h / 2 + 8,
      text: `${name}\nSaldo: R$ ${saldo}`,
      fontSize: 14,
      fill: 'black',
      align: 'center',
    });
    layer.add(label);
    entity.label = label;
    // centralizar label
    label.offsetX(label.width() / 2);

    // quando arrastar, atualiza label e linhas conectadas
    img.on('dragmove', () => {
      entity.label.x(img.x());
      entity.label.y(img.y() + (entity.node.height() / 2) + 8);
      entity.label.offsetX(entity.label.width() / 2);
      if (entity.lines) {
        entity.lines.forEach(line => {
          line.points([line.from.node.x(), line.from.node.y(), line.to.node.x(), line.to.node.y()]);
        });
      }
      layer.batchDraw();
    });

    layer.batchDraw();
  };
  return entity;
}

function createLine(from, to) {
  const line = new Konva.Line({
    points: [from.node.x(), from.node.y(), to.node.x(), to.node.y()],
    stroke: '#666',
    strokeWidth: 2,
  });
  layer.add(line);
  line.from = from;
  line.to = to;
  from.lines = from.lines || [];
  to.lines = to.lines || [];
  from.lines.push(line);
  to.lines.push(line);
  return line;
}

// aguarda até que todas as entidades tenham .node (imagem carregada)
function waitForEntitiesReady(entitiesObj, cb) {
  const names = Object.keys(entitiesObj);
  const check = () => {
    const ready = names.every(k => entitiesObj[k].node);
    if (ready) {
      cb();
    } else {
      setTimeout(check, 100);
    }
  };
  check();
}

// animação da transferência (tipo define cor)
function animateTransfer(from, to, valor = 100, tempoMs = 2000, tipo = 'comercio') {
  const color = transferTypes[tipo]?.color || 'gray';
  // débito imediato
  from.saldo -= valor;
  updateLabel(from);

  const start = { x: from.node.x(), y: from.node.y() };
  const end = { x: to.node.x(), y: to.node.y() };

  const circle = new Konva.Circle({
    x: start.x,
    y: start.y,
    radius: Math.max(6, Math.min(14, Math.log10(Math.max(1, valor)) * 6 + 6)), // tamanho relativo ao valor (opcional)
    fill: color,
    opacity: 0.95,
  });
  layer.add(circle);

  const txt = new Konva.Text({
    x: start.x + 12,
    y: start.y - 12,
    text: `R$ ${valor}\n(${tipo})`,
    fontSize: 12,
    fill: color,
  });
  layer.add(txt);

  const tween = new Konva.Tween({
    node: circle,
    duration: tempoMs / 1000,
    x: end.x,
    y: end.y,
    easing: Konva.Easings.EaseInOut,
    onUpdate: () => {
      txt.x(circle.x() + 12);
      txt.y(circle.y() - 12);
      layer.batchDraw();
    },
    onFinish: () => {
      circle.destroy();
      txt.destroy();
      // crédito ao chegar
      to.saldo += valor;
      updateLabel(to);
      layer.batchDraw();
    },
  });

  tween.play();
}

function populateControls() {
  const container = document.getElementById('sliders-container');
  if (!container) return;

  container.innerHTML = '';

  Object.keys(transferTypes).forEach(type => {
    const div = document.createElement('div');
    div.className = 'mb-3';
    div.innerHTML = `
      <label class="form-label">${transferTypes[type].label}: <span id="value-${type}">1.0x</span></label>
      <input type="range" class="form-range" id="slider-${type}" min="0" max="2" step="0.1" value="1">
    `;
    container.appendChild(div);

    const slider = document.getElementById(`slider-${type}`);
    slider.addEventListener('input', () => updateMultiplier(type, parseFloat(slider.value)));
  });
}

function updateMultiplier(type, value) {
  multipliers[type] = value;
  document.getElementById(`value-${type}`).textContent = `${value.toFixed(1)}x`;
  recalculateTransfers();
}

function recalculateTransfers() {
  activeTransfers = originalTransfers.map(t => ({
    ...t,
    amount: Math.round(t.amount * multipliers[t.type])
  }));
  preencherTabela(activeTransfers, entitiesData);
}

// caminho para seu JSON (pode ser um arquivo local ou endpoint da API)
const DATA_URL = "data.json";

fetch(DATA_URL)
  .then(res => res.json())
  .then(data => {
    entitiesData = data.entities;
    activeTransfers = data.transfers.map(t => ({...t}));
    if (containerElem) {
      createStage();
      initSimulation(data);
      setupSimulationControls();
    }
    preencherTabela(activeTransfers, entitiesData);
  })
  .catch(err => console.error("Erro carregando dados:", err));

function initSimulation(data) {
  const entities = {};
  
  // criar entidades dinamicamente, subindo 40px para evitar corte das labels
  data.entities.forEach(e => {
    entities[e.id] = createEntity(e.img, e.x, e.y - 40, e.name, e.saldo);
  });

  waitForEntitiesReady(entities, () => {
    // criar linhas com base nas transferências
    data.transfers.forEach(t => {
      if (entities[t.from] && entities[t.to]) {
        createLine(entities[t.from], entities[t.to]);
      }
    });

    // criar animações com base nas transferências
    activeTransfers.forEach(t => {
      setInterval(() => {
        if (!isPlaying) return;
        animateTransfer(
          entities[t.from],
          entities[t.to],
          t.amount,
          2000, // tempo fixo de animação
          t.type
        );
      }, t.interval);
    });
  });

  // criar legenda dentro do gráfico
  createLegendKonva();
}

function setupSimulationControls() {
  const playPauseBtn = document.getElementById('play-pause-btn');
  const resetBtn = document.getElementById('reset-btn');
  const dayCounter = document.getElementById('day-counter');

  if (!playPauseBtn || !resetBtn || !dayCounter) return;

  playPauseBtn.addEventListener('click', () => {
    isPlaying = !isPlaying;
    playPauseBtn.textContent = isPlaying ? '⏸️ Pause' : '▶️ Play';
    playPauseBtn.className = isPlaying ? 'btn btn-warning btn-sm me-2' : 'btn btn-success btn-sm me-2';

    if (isPlaying) {
      startDayCounter();
    } else {
      stopDayCounter();
    }
  });

  resetBtn.addEventListener('click', () => {
    isPlaying = false;
    currentDay = 0;
    dayCounter.textContent = currentDay;
    playPauseBtn.textContent = '▶️ Play';
    playPauseBtn.className = 'btn btn-success btn-sm me-2';
    stopDayCounter();
    // Opcional: resetar saldos das entidades
  });
}

function startDayCounter() {
  if (dayInterval) return;
  dayInterval = setInterval(() => {
    currentDay++;
    document.getElementById('day-counter').textContent = currentDay;
  }, 1000);
}

function stopDayCounter() {
  if (dayInterval) {
    clearInterval(dayInterval);
    dayInterval = null;
  }
}

function createLegendKonva() {
  console.log('Creating legend');
  if (!stage || !layer) {
    console.log('No stage or layer');
    return;
  }

  // Remover legenda anterior se existir
  if (legendGroup) {
    legendGroup.destroy();
  }

  legendGroup = new Konva.Group();
  layer.add(legendGroup);

  const legendX = stage.width() - 200;
  const legendY = 10;
  let currentY = legendY;

  console.log('Legend position:', legendX, legendY);

  // Fundo semi-transparente
  const bg = new Konva.Rect({
    x: legendX - 10,
    y: legendY - 5,
    width: 190,
    height: Object.keys(transferTypes).length * 20 + 30,
    fill: 'rgba(255, 255, 255, 0.9)',
    stroke: '#ccc',
    strokeWidth: 1,
    cornerRadius: 5,
  });
  legendGroup.add(bg);

  // Título
  const title = new Konva.Text({
    x: legendX,
    y: currentY,
    text: 'Legenda:',
    fontSize: 14,
    fontStyle: 'bold',
    fill: 'black',
  });
  legendGroup.add(title);
  currentY += 20;

  Object.keys(transferTypes).forEach(key => {
    const color = transferTypes[key].color;
    const label = transferTypes[key].label;

    // Quadrado de cor
    const rect = new Konva.Rect({
      x: legendX,
      y: currentY,
      width: 14,
      height: 14,
      fill: color,
      stroke: '#000',
      strokeWidth: 1,
    });
    legendGroup.add(rect);

    // Texto
    const text = new Konva.Text({
      x: legendX + 20,
      y: currentY,
      text: label,
      fontSize: 12,
      fill: 'black',
    });
    legendGroup.add(text);

    currentY += 18;
  });

  layer.batchDraw();
  console.log('Legend created');
}

function preencherTabela(transfers, entities) {
  const tbody = document.querySelector("#tabela-orcamento tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  // Função para buscar o nome pelo id
  function getEntityName(id) {
    const entidade = entities.find(e => e.id === id);
    return entidade ? entidade.name : id;
  }

  transfers.forEach((item, index) => {
    const linha = document.createElement("tr");
    linha.innerHTML = `
      <td>${getEntityName(item.from)}</td>
      <td>${item.type}</td>
      <td><input type="number" class="form-control form-control-sm" value="${item.amount}" data-index="${index}" min="0" step="10"></td>
      <td>${getEntityName(item.to)}</td>
    `;
    tbody.appendChild(linha);
  });

  // Adicionar event listeners para inputs
  tbody.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', (e) => {
      const index = parseInt(e.target.dataset.index);
      activeTransfers[index].amount = parseInt(e.target.value) || 0;
      // Se DataTable, recarregar
      if ($.fn.DataTable && $('#tabela-orcamento').DataTable()) {
        $('#tabela-orcamento').DataTable().destroy();
        preencherTabela(activeTransfers, entitiesData);
      }
    });
  });

  // Inicializar DataTable se jQuery e DataTable estiverem disponíveis
  if (typeof $ !== 'undefined' && $.fn.DataTable) {
    $('#tabela-orcamento').DataTable({
      responsive: true,
      language: {
        url: 'https://cdn.datatables.net/plug-ins/1.13.4/i18n/pt-BR.json'
      }
    });
  }
}