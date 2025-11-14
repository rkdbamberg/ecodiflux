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
const stage = new Konva.Stage({
  container: 'container',
  width: 1200,
  height: 800, // aumenta a altura
});
const layer = new Konva.Layer();
stage.add(layer);

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

function createLegendHTML() {
  const legendaDiv = document.getElementById('legenda');
  legendaDiv.innerHTML = '<strong>Legenda:</strong><br>';
  Object.keys(transferTypes).forEach(key => {
    const color = transferTypes[key].color;
    const label = transferTypes[key].label;
    legendaDiv.innerHTML += `
      <span style="display:inline-block;width:14px;height:14px;background:${color};border-radius:3px;margin-right:6px;"></span>
      ${label}<br>
    `;
  });
}

// caminho para seu JSON (pode ser um arquivo local ou endpoint da API)
const DATA_URL = "data.json";

fetch(DATA_URL)
  .then(res => res.json())
  .then(data => {
    initSimulation(data);
    createLegendHTML();
  })
  .catch(err => console.error("Erro carregando dados:", err));

function initSimulation(data) {
  const entities = {};
  
  // criar entidades dinamicamente
  data.entities.forEach(e => {
    entities[e.id] = createEntity(e.img, e.x, e.y, e.name, e.saldo);
  });

  waitForEntitiesReady(entities, () => {
    // criar linhas com base nas transferências
    data.transfers.forEach(t => {
      if (entities[t.from] && entities[t.to]) {
        createLine(entities[t.from], entities[t.to]);
      }
    });

    // legenda fixa
    //createLegend();

    // criar animações com base nas transferências
    data.transfers.forEach(t => {
      setInterval(() => {
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
}

fetch('data.json')
  .then(response => response.json())
  .then(dados => preencherTabela(dados.transfers, dados.entities));

function preencherTabela(transfers, entities) {
  const tbody = document.querySelector("#tabela-orcamento tbody");
  tbody.innerHTML = "";

  // Função para buscar o nome pelo id
  function getEntityName(id) {
    const entidade = entities.find(e => e.id === id);
    return entidade ? entidade.name : id;
  }

  transfers.forEach(item => {
    const linha = document.createElement("tr");
    linha.innerHTML = `
      <td>${getEntityName(item.from)}</td>
      <td>${item.type}</td>
      <td>R$ ${item.amount.toLocaleString('pt-BR')}</td>
      <td>${getEntityName(item.to)}</td>
    `;
    tbody.appendChild(linha);
  });
}