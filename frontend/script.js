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
  width: window.innerWidth,
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

// cria uma legenda fixa no canto superior direito
function createLegend() {
  const padding = 10;
  const itemH = 22;
  const items = Object.keys(transferTypes);
  const boxW = 170;
  const boxH = items.length * itemH + padding * 2;
  const x = stage.width() - boxW - 20;
  const y = 20;

  const bg = new Konva.Rect({
    x, y, width: boxW, height: boxH, cornerRadius: 8, fill: 'rgba(255,255,255,0.9)', stroke: '#ccc', strokeWidth: 1
  });
  const grp = new Konva.Group();
  grp.add(bg);

  items.forEach((key, i) => {
    const color = transferTypes[key].color;
    const label = transferTypes[key].label || key;
    const rect = new Konva.Rect({
      x: x + padding,
      y: y + padding + i * itemH + 4,
      width: 14,
      height: 14,
      fill: color,
      cornerRadius: 3,
    });
    const txt = new Konva.Text({
      x: x + padding + 20,
      y: y + padding + i * itemH,
      text: `${label}`,
      fontSize: 13,
      fill: '#333',
    });
    grp.add(rect);
    grp.add(txt);
  });

  layer.add(grp);
  layer.batchDraw();
}

// caminho para seu JSON (pode ser um arquivo local ou endpoint da API)
const DATA_URL = "data.json";

fetch(DATA_URL)
  .then(res => res.json())
  .then(data => {
    initSimulation(data);
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
    createLegend();

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