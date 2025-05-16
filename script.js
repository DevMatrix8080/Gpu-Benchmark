document.addEventListener("DOMContentLoaded", function () {
  const canvas = document.getElementById("gpu-canvas");
  const gl =
    canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  const fpsDisplay = document.getElementById("fps");
  const startBtn = document.getElementById("start-btn");

  // Canvas per il grafico FPS
  let chartCanvas = document.getElementById("fps-chart");
  if (!chartCanvas) {
    chartCanvas = document.createElement("canvas");
    chartCanvas.id = "fps-chart";
    chartCanvas.width = 800;
    chartCanvas.height = 100;
    chartCanvas.style.marginTop = "20px";
    document.getElementById("gpu-container").appendChild(chartCanvas);
  }
  const chartCtx = chartCanvas.getContext("2d");

  // Selettore complessità
  let complexitySelector = document.getElementById("complexity");
  if (!complexitySelector) {
    complexitySelector = document.createElement("select");
    complexitySelector.id = "complexity";
    ["Alto", "Estremo", "Ultra", "Assurdo"].forEach((label, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = label;
      complexitySelector.appendChild(opt);
    });
    const label = document.createElement("label");
    label.textContent = "Complessità: ";
    label.style.marginRight = "10px";
    label.appendChild(complexitySelector);
    document.getElementById("gpu-container").insertBefore(label, canvas);
  }

  if (!gl) {
    fpsDisplay.textContent = "WebGL non supportato dal browser!";
    if (startBtn) startBtn.disabled = true;
    return;
  }

  // Vertex shader con animazione
  const vsSource = `
        attribute vec2 aPosition;
        attribute vec3 aColor;
        varying vec3 vColor;
        uniform float uTime;
        void main(void) {
            float scale = 0.8 + 0.2 * sin(uTime + aPosition.x * 10.0 + aPosition.y * 10.0);
            gl_Position = vec4(aPosition * scale, 0.0, 1.0);
            vColor = aColor;
        }
    `;

  // Fragment shader pesante
  const fsSource = `
        precision highp float;
        varying vec3 vColor;
        uniform float uTime;
        void main(void) {
            // Calcolo pesante per stressare la GPU
            float x = gl_FragCoord.x / 800.0;
            float y = gl_FragCoord.y / 600.0;
            float sum = 0.0;
            for(int i = 0; i < 100; i++) {
                sum += sin(uTime * 0.1 + float(i) * x * y) * cos(uTime * 0.1 + float(i) * x * y);
            }
            float brightness = 0.5 + 0.5 * sin(uTime + sum);
            gl_FragColor = vec4(vColor * brightness, 1.0);
        }
    `;

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }

  function createProgram(gl, vsSource, fsSource) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    return program;
  }

  const program = createProgram(gl, vsSource, fsSource);
  gl.useProgram(program);

  // Genera triangoli e colori random in base alla complessità
  function generateVertices(level) {
    let TRIANGLE_COUNT;
    switch (parseInt(level)) {
      case 0:
        TRIANGLE_COUNT = 300000;
        break; // Alto
      case 1:
        TRIANGLE_COUNT = 800000;
        break; // Estremo
      case 2:
        TRIANGLE_COUNT = 2000000;
        break; // Ultra
      case 3:
        TRIANGLE_COUNT = 5000000;
        break; // Assurdo
      default:
        TRIANGLE_COUNT = 300000;
    }
    const vertices = [];
    const colors = [];
    for (let i = 0; i < TRIANGLE_COUNT; i++) {
      const x = Math.random() * 2 - 1;
      const y = Math.random() * 2 - 1;
      const size = Math.random() * 0.01 + 0.002;
      // Vertice 1
      vertices.push(x, y);
      colors.push(Math.random(), Math.random(), Math.random());
      // Vertice 2
      vertices.push(x + size, y);
      colors.push(Math.random(), Math.random(), Math.random());
      // Vertice 3
      vertices.push(x, y + size);
      colors.push(Math.random(), Math.random(), Math.random());
    }
    return { vertices, colors, TRIANGLE_COUNT };
  }

  let { vertices, colors, TRIANGLE_COUNT } = generateVertices(
    complexitySelector.value
  );

  let vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

  let colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

  const aPosition = gl.getAttribLocation(program, "aPosition");
  const aColor = gl.getAttribLocation(program, "aColor");
  const uTime = gl.getUniformLocation(program, "uTime");

  // Aggiorna i dati se cambia la complessità
  complexitySelector.addEventListener("change", function () {
    const res = generateVertices(complexitySelector.value);
    vertices = res.vertices;
    colors = res.colors;
    TRIANGLE_COUNT = res.TRIANGLE_COUNT;
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
  });

  let running = false;
  let lastTime = 0;
  let frames = 0;
  let frameTimes = [];
  let fpsHistory = [];
  const MAX_HISTORY = 800;

  function render(now) {
    if (!running) return;
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Posizioni
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPosition);

    // Colori
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aColor);

    // Uniform tempo
    gl.uniform1f(uTime, now * 0.001);

    gl.drawArrays(gl.TRIANGLES, 0, TRIANGLE_COUNT * 3);
    frames++;
    frameTimes.push(now);

    // Aggiorna ogni secondo
    if (now - lastTime >= 1000) {
      const fps = frames;
      fpsHistory.push(fps);
      if (fpsHistory.length > MAX_HISTORY) fpsHistory.shift();

      // Tempo medio frame
      let avgFrame = 0;
      if (frameTimes.length > 1) {
        let sum = 0;
        for (let i = 1; i < frameTimes.length; i++) {
          sum += frameTimes[i] - frameTimes[i - 1];
        }
        avgFrame = sum / (frameTimes.length - 1);
      }

      // Varianza FPS
      let mean = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;
      let variance =
        fpsHistory.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
        fpsHistory.length;

      fpsDisplay.innerHTML = `
                <b>FPS:</b> ${fps}<br>
                <b>Tempo medio frame:</b> ${avgFrame.toFixed(2)} ms<br>
                <b>Varianza FPS:</b> ${variance.toFixed(2)}<br>
                <b>Triangoli:</b> ${TRIANGLE_COUNT}
            `;

      drawChart(fpsHistory);

      frames = 0;
      lastTime = now;
      frameTimes = [];
    }
    requestAnimationFrame(render);
  }

  function drawChart(history) {
    chartCtx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
    chartCtx.beginPath();
    chartCtx.moveTo(0, chartCanvas.height - history[0]);
    for (let i = 1; i < history.length; i++) {
      chartCtx.lineTo(i, chartCanvas.height - history[i]);
    }
    chartCtx.strokeStyle = "#4caf50";
    chartCtx.lineWidth = 2;
    chartCtx.stroke();
    // Asse X e Y
    chartCtx.strokeStyle = "#888";
    chartCtx.beginPath();
    chartCtx.moveTo(0, chartCanvas.height - 1);
    chartCtx.lineTo(chartCanvas.width, chartCanvas.height - 1);
    chartCtx.moveTo(1, 0);
    chartCtx.lineTo(1, chartCanvas.height);
    chartCtx.stroke();
  }

  if (startBtn) {
    startBtn.addEventListener("click", function () {
      if (!running) {
        running = true;
        frames = 0;
        lastTime = performance.now();
        fpsDisplay.textContent = "Benchmark in corso...";
        fpsHistory = [];
        frameTimes = [];
        requestAnimationFrame(render);
        startBtn.textContent = "Ferma Benchmark";
      } else {
        running = false;
        startBtn.textContent = "Avvia Benchmark";
      }
    });
  }
});
