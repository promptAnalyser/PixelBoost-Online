document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const loadingSpinner = document.getElementById("loadingSpinner");
  const spinnerActionText = document.getElementById("spinnerActionText");
  const imageUpload = document.getElementById("imageUpload");
  const fileNameDisplay = document.getElementById("fileName");

  const imagePreviewContainer = document.getElementById(
    "imagePreviewContainer"
  );
  const imagePreview = document.getElementById("imagePreview");
  const previewPlaceholder = document.getElementById("previewPlaceholder");
  const watermarkSelectionCanvas = document.getElementById(
    "watermarkSelectionCanvas"
  );
  const watermarkCtx = watermarkSelectionCanvas.getContext("2d");

  const mainControlsSection = document.getElementById("mainControlsSection");
  const allAnimatedSections = document.querySelectorAll(".animated-section");
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");

  const clearWatermarkSelectionButton = document.getElementById(
    "clearWatermarkSelectionButton"
  );
  const applyWatermarkRemovalButton = document.getElementById(
    "applyWatermarkRemovalButton"
  );
  const watermarkSelectionInfo = document.getElementById(
    "watermarkSelectionInfo"
  );

  const newWidthInput = document.getElementById("newWidth");
  const newHeightInput = document.getElementById("newHeight");
  const lockAspectRatioCheckbox = document.getElementById("lockAspectRatio");
  const aspectRatioPresetSelect = document.getElementById("aspectRatioPreset");

  const resizeModeRadios = document.querySelectorAll(
    'input[name="resizeMode"]'
  );
  const fitBackgroundColorDiv = document.getElementById(
    "fitBackgroundColorDiv"
  );
  const fitBackgroundColorInput = document.getElementById("fitBackgroundColor");

  const compressionQualityRange = document.getElementById(
    "compressionQualityRange"
  );
  const compressionQualityValueDisplay = document.getElementById(
    "compressionQualityValue"
  );

  const previewResizeButton = document.getElementById("previewResizeButton");

  const outputSection = document.getElementById("outputSection");
  const successIndicator = document.getElementById("successIndicator");
  const resizedCanvasPreview = document.getElementById("resizedCanvasPreview");
  const resizedPreviewPlaceholder = document.getElementById(
    "resizedPreviewPlaceholder"
  );
  const estimatedFileSizeDisplay = document.getElementById("estimatedFileSize");
  const downloadButton = document.getElementById("downloadButton");
  const outputInfo = document.getElementById("outputInfo");

  const processingCanvas = document.getElementById("processingCanvas");
  const messagesDiv = document.getElementById("messages");

  const helpButton = document.getElementById("helpButton");
  const helpModal = document.getElementById("helpModal");
  const closeHelpModalButton = document.getElementById("closeHelpModal");

  const successSound = document.getElementById("successSound");

  document.getElementById("currentYear").textContent = new Date().getFullYear();

  // State
  let originalImageObject = null,
    originalFileName = "processed_image.png",
    originalFileMimeType = "image/png";
  let originalAspectRatio = 1,
    isUserManuallyEditingDimension = false;
  const MAX_PREVIEW_DIMENSION = 300,
    MAX_CANVAS_DIMENSION = 16384;
  let isWatermarkEffectAppliedToProcessingCanvas = false;
  let isDrawingWatermark = false,
    watermarkRectOriginalCoords = { x: 0, y: 0, w: 0, h: 0, active: false };
  let selectionStartCoords = { x: 0, y: 0 };

  // Initial Animation for sections already visible
  document
    .querySelectorAll(
      ".tool-section.upload-section, .support-section.animated-section"
    )
    .forEach((section) => {
      section.style.opacity = "1";
      section.style.transform = "translateY(0)";
    });

  // --- Event Listeners ---
  imageUpload.addEventListener("change", handleImageUpload);

  tabButtons.forEach((button) =>
    button.addEventListener("click", handleTabSwitch)
  );

  newWidthInput.addEventListener("input", () => handleDimensionChange("width"));
  newHeightInput.addEventListener("input", () =>
    handleDimensionChange("height")
  );
  lockAspectRatioCheckbox.addEventListener("change", handleLockToggle);
  aspectRatioPresetSelect.addEventListener("change", handlePresetChange);
  resizeModeRadios.forEach((radio) =>
    radio.addEventListener("change", handleResizeModeChange)
  );
  compressionQualityRange.addEventListener("input", () => {
    compressionQualityValueDisplay.textContent = compressionQualityRange.value;
    if (outputSection.style.display === "block" && !downloadButton.disabled)
      updateEstimatedFileSize();
  });

  previewResizeButton.addEventListener("click", () =>
    handlePreviewResizeAndCompression(false)
  ); // Explicitly pass false
  downloadButton.addEventListener("click", handleImageDownload);

  watermarkSelectionCanvas.addEventListener("mousedown", startWatermarkDraw);
  watermarkSelectionCanvas.addEventListener("mousemove", drawWatermarkRect);
  watermarkSelectionCanvas.addEventListener("mouseup", endWatermarkDraw);
  watermarkSelectionCanvas.addEventListener("mouseleave", endWatermarkDraw);
  clearWatermarkSelectionButton.addEventListener(
    "click",
    clearWatermarkSelection
  );
  applyWatermarkRemovalButton.addEventListener(
    "click",
    applyBasicWatermarkRemoval
  );

  helpButton.addEventListener(
    "click",
    () => (helpModal.style.display = "flex")
  );
  closeHelpModalButton.addEventListener(
    "click",
    () => (helpModal.style.display = "none")
  );
  window.addEventListener("click", (event) => {
    if (event.target === helpModal) helpModal.style.display = "none";
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && helpModal.style.display === "flex")
      helpModal.style.display = "none";
  });

  // --- Helper Functions ---
  function showSpinner(actionText = "Processing...") {
    spinnerActionText.textContent = actionText;
    loadingSpinner.style.opacity = "1"; // For fade-in
    loadingSpinner.style.display = "flex";
  }
  function hideSpinner() {
    loadingSpinner.style.opacity = "0";
    setTimeout(() => (loadingSpinner.style.display = "none"), 300); // Match CSS transition
  }
  function playSuccessSound() {
    if (successSound && successSound.readyState >= 2) {
      // HAVE_CURRENT_DATA or more
      successSound.currentTime = 0; // Rewind
      successSound.play().catch((e) => console.warn("Audio play failed:", e)); // Browser might block autoplay
    }
  }
  function showSuccessIndicator() {
    successIndicator.style.display = "flex";
    setTimeout(() => {
      successIndicator.style.display = "none";
    }, 1500); // Display for 1.5 seconds
  }

  // --- Core Functions (with UI/UX enhancements) ---
  async function handleImageUpload(event) {
    showSpinner("Loading image...");
    await new Promise((resolve) => setTimeout(resolve, 50));
    try {
      clearMessages();
      const file = event.target.files[0];
      if (!file) {
        displayMessage("No file selected. Please choose an image.", "error");
        resetFullInterface();
        return;
      }
      originalFileMimeType = file.type;
      const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif",
      ];
      if (!allowedTypes.includes(file.type)) {
        displayMessage(`Invalid file type. Try PNG, JPG, WEBP, GIF.`, "error");
        resetFullInterface();
        return;
      }
      const MAX_FILE_SIZE_MB = 15;
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        displayMessage(`File too large (Max ${MAX_FILE_SIZE_MB}MB).`, "error");
        resetFullInterface();
        return;
      }

      originalFileName = file.name;
      fileNameDisplay.textContent = `Selected: ${file.name} (${(
        file.size /
        (1024 * 1024)
      ).toFixed(2)} MB)`;

      const reader = new FileReader();
      reader.onload = (e) => {
        originalImageObject = new Image();
        originalImageObject.onload = () => {
          originalAspectRatio =
            originalImageObject.naturalWidth /
            originalImageObject.naturalHeight;
          newWidthInput.value = originalImageObject.naturalWidth;
          newHeightInput.value = originalImageObject.naturalHeight;
          aspectRatioPresetSelect.value = "original";
          imagePreview.src = e.target.result;
          imagePreview.style.display = "block";
          previewPlaceholder.style.display = "none";
          setupWatermarkCanvas();

          mainControlsSection.style.display = "block";
          allAnimatedSections.forEach((s) => {
            if (s.id === "mainControlsSection") {
              s.style.opacity = "1";
              s.style.transform = "translateY(0)";
            }
          });

          outputSection.style.display = "none"; // Hide output section initially
          downloadButton.disabled = true;
          isWatermarkEffectAppliedToProcessingCanvas = false;
          handleResizeModeChange();
          handlePreviewResizeAndCompression(true);
          playSuccessSound();
        };
        originalImageObject.onerror = () => {
          displayMessage(
            "Could not load image data. File might be corrupted or an unsupported format.",
            "error"
          );
          resetFullInterface();
        };
        originalImageObject.src = e.target.result;
      };
      reader.onerror = () => {
        displayMessage("Error reading the selected file.", "error");
        resetFullInterface();
      };
      reader.readAsDataURL(file);
    } finally {
      hideSpinner();
    }
  }

  function handleTabSwitch(event) {
    tabButtons.forEach((btn) => btn.classList.remove("active"));
    tabContents.forEach((content) => content.classList.remove("active"));
    event.currentTarget.classList.add("active");
    document
      .getElementById(event.currentTarget.dataset.tab)
      .classList.add("active");
  }

  function setupWatermarkCanvas() {
    if (
      !originalImageObject ||
      !imagePreview.complete ||
      imagePreview.naturalWidth === 0
    )
      return;
    const previewRect = imagePreview.getBoundingClientRect();
    const containerRect = imagePreviewContainer.getBoundingClientRect();
    let renderedWidth, renderedHeight, offsetX, offsetY;
    const imgAspect =
      originalImageObject.naturalWidth / originalImageObject.naturalHeight;
    const containerAspect =
      imagePreviewContainer.clientWidth / imagePreviewContainer.clientHeight;
    if (imgAspect > containerAspect) {
      renderedWidth = imagePreviewContainer.clientWidth;
      renderedHeight = renderedWidth / imgAspect;
      offsetX = 0;
      offsetY = (imagePreviewContainer.clientHeight - renderedHeight) / 2;
    } else {
      renderedHeight = imagePreviewContainer.clientHeight;
      renderedWidth = renderedHeight * imgAspect;
      offsetX = (imagePreviewContainer.clientWidth - renderedWidth) / 2;
      offsetY = 0;
    }
    watermarkSelectionCanvas.width = renderedWidth;
    watermarkSelectionCanvas.height = renderedHeight;
    watermarkSelectionCanvas.style.left = `${offsetX}px`;
    watermarkSelectionCanvas.style.top = `${offsetY}px`;
    watermarkSelectionCanvas.style.display = "block";
    clearWatermarkSelectionDrawing();
    watermarkSelectionInfo.textContent = "Drag on image to select watermark.";
  }
  function startWatermarkDraw(e) {
    if (!originalImageObject) return;
    isDrawingWatermark = true;
    selectionStartCoords = { x: e.offsetX, y: e.offsetY };
    clearWatermarkSelectionDrawing();
  }
  function drawWatermarkRect(e) {
    if (!isDrawingWatermark || !originalImageObject) return;
    const currentX = e.offsetX;
    const currentY = e.offsetY;
    clearWatermarkSelectionDrawing();
    watermarkCtx.strokeStyle = `rgba(${getComputedStyle(
      document.documentElement
    ).getPropertyValue("--accent-color-rgb")}, 0.8)`;
    watermarkCtx.lineWidth = 2;
    watermarkCtx.setLineDash([6, 4]);
    watermarkCtx.strokeRect(
      selectionStartCoords.x,
      selectionStartCoords.y,
      currentX - selectionStartCoords.x,
      currentY - selectionStartCoords.y
    );
    watermarkCtx.setLineDash([]);
  }
  function endWatermarkDraw(e) {
    if (!isDrawingWatermark || !originalImageObject) return;
    isDrawingWatermark = false;
    const endX = e.offsetX;
    const endY = e.offsetY;
    const overlayRectX = Math.min(selectionStartCoords.x, endX);
    const overlayRectY = Math.min(selectionStartCoords.y, endY);
    const overlayRectW = Math.abs(endX - selectionStartCoords.x);
    const overlayRectH = Math.abs(endY - selectionStartCoords.y);
    if (overlayRectW < 5 || overlayRectH < 5) {
      watermarkRectOriginalCoords.active = false;
      clearWatermarkSelectionDrawing();
      watermarkSelectionInfo.textContent = "Selection too small. Try again.";
      return;
    }
    const scaleX =
      originalImageObject.naturalWidth / watermarkSelectionCanvas.width;
    const scaleY =
      originalImageObject.naturalHeight / watermarkSelectionCanvas.height;
    watermarkRectOriginalCoords = {
      x: overlayRectX * scaleX,
      y: overlayRectY * scaleY,
      w: overlayRectW * scaleX,
      h: overlayRectH * scaleY,
      active: true,
    };
    clearWatermarkSelectionDrawing();
    watermarkCtx.strokeStyle = `rgba(${getComputedStyle(
      document.documentElement
    ).getPropertyValue("--secondary-color-rgb")}, 0.9)`;
    watermarkCtx.lineWidth = 2;
    watermarkCtx.strokeRect(
      overlayRectX,
      overlayRectY,
      overlayRectW,
      overlayRectH
    );
    watermarkSelectionInfo.textContent = `Selected! (X:${watermarkRectOriginalCoords.x.toFixed(
      0
    )}, Y:${watermarkRectOriginalCoords.y.toFixed(
      0
    )}, W:${watermarkRectOriginalCoords.w.toFixed(
      0
    )}, H:${watermarkRectOriginalCoords.h.toFixed(0)})`;
    playSuccessSound();
  }
  function clearWatermarkSelectionDrawing() {
    watermarkCtx.clearRect(
      0,
      0,
      watermarkSelectionCanvas.width,
      watermarkSelectionCanvas.height
    );
  }
  function clearWatermarkSelection() {
    watermarkRectOriginalCoords.active = false;
    clearWatermarkSelectionDrawing();
    watermarkSelectionInfo.textContent =
      "Selection cleared. Drag on image to select again.";
  }

  async function applyBasicWatermarkRemoval() {
    if (!watermarkRectOriginalCoords.active) {
      displayMessage(
        "Please select a watermark area first using the main image preview.",
        "error"
      );
      return;
    }
    if (!processingCanvas.width || !processingCanvas.height) {
      displayMessage(
        "Please generate a preview first (Resize & Compress tab).",
        "error"
      );
      return;
    }
    showSpinner("Applying basic watermark removal...");
    await new Promise((resolve) => setTimeout(resolve, 10));
    try {
      const procCtx = processingCanvas.getContext("2d", {
        willReadFrequently: true,
      });
      const scaleToProcX =
        processingCanvas.width / originalImageObject.naturalWidth;
      const scaleToProcY =
        processingCanvas.height / originalImageObject.naturalHeight;
      const targetRectX = Math.round(
        watermarkRectOriginalCoords.x * scaleToProcX
      );
      const targetRectY = Math.round(
        watermarkRectOriginalCoords.y * scaleToProcY
      );
      const targetRectW = Math.round(
        watermarkRectOriginalCoords.w * scaleToProcX
      );
      const targetRectH = Math.round(
        watermarkRectOriginalCoords.h * scaleToProcY
      );
      if (targetRectW <= 0 || targetRectH <= 0) {
        displayMessage(
          "Watermark selection is too small on the processed image.",
          "error"
        );
        hideSpinner();
        return;
      }
      const imageData = procCtx.getImageData(
        0,
        0,
        processingCanvas.width,
        processingCanvas.height
      );
      const pixels = imageData.data;
      const canvasWidth = processingCanvas.width;
      let avgR = 0,
        avgG = 0,
        avgB = 0;
      let count = 0;
      const borderThickness = Math.max(
        1,
        Math.min(3, Math.floor(Math.min(targetRectW, targetRectH) * 0.1))
      );
      for (
        let y = Math.max(0, targetRectY - borderThickness);
        y < Math.min(canvasWidth, targetRectY + targetRectH + borderThickness);
        y++
      ) {
        for (
          let x = Math.max(0, targetRectX - borderThickness);
          x <
          Math.min(canvasWidth, targetRectX + targetRectW + borderThickness);
          x++
        ) {
          if (
            y < targetRectY ||
            y >= targetRectY + targetRectH ||
            x < targetRectX ||
            x >= targetRectX + targetRectW
          ) {
            const i = (y * canvasWidth + x) * 4;
            if (i < pixels.length) {
              avgR += pixels[i];
              avgG += pixels[i + 1];
              avgB += pixels[i + 2];
              count++;
            }
          }
        }
      }
      if (count > 0) {
        avgR = Math.round(avgR / count);
        avgG = Math.round(avgG / count);
        avgB = Math.round(avgB / count);
        for (let y = targetRectY; y < targetRectY + targetRectH; y++) {
          for (let x = targetRectX; x < targetRectX + targetRectW; x++) {
            if (
              x >= 0 &&
              x < canvasWidth &&
              y >= 0 &&
              y < processingCanvas.height
            ) {
              const i = (y * canvasWidth + x) * 4;
              pixels[i] = avgR;
              pixels[i + 1] = avgG;
              pixels[i + 2] = avgB;
            }
          }
        }
        procCtx.putImageData(imageData, 0, 0);
        isWatermarkEffectAppliedToProcessingCanvas = true;
        displayMessage(
          "Basic watermark removal applied to current preview. Results vary.",
          "success"
        );
        playSuccessSound();
        showSuccessIndicator();
      } else {
        displayMessage(
          "Could not sample border pixels. Try a larger selection or ensure it's not at the very edge.",
          "error"
        );
      }
      updateResizedCanvasPreviewFromProcessing();
      updateEstimatedFileSize();
    } catch (error) {
      console.error("Error during watermark removal:", error);
      displayMessage(`Watermark removal failed: ${error.message}.`, "error");
    } finally {
      hideSpinner();
    }
  }

  function handleDimensionChange(changedDimension) {
    if (isUserManuallyEditingDimension) return;
    isUserManuallyEditingDimension = true;
    if (lockAspectRatioCheckbox.checked && originalImageObject) {
      const widthVal = parseInt(newWidthInput.value, 10);
      const heightVal = parseInt(newHeightInput.value, 10);
      if (changedDimension === "width" && !isNaN(widthVal) && widthVal > 0) {
        newHeightInput.value = Math.round(widthVal / originalAspectRatio);
      } else if (
        changedDimension === "height" &&
        !isNaN(heightVal) &&
        heightVal > 0
      ) {
        newWidthInput.value = Math.round(heightVal * originalAspectRatio);
      }
    }
    if (lockAspectRatioCheckbox.checked) {
      const currentWidth = parseInt(newWidthInput.value, 10);
      const currentHeight = parseInt(newHeightInput.value, 10);
      if (
        !isNaN(currentWidth) &&
        currentWidth > 0 &&
        !isNaN(currentHeight) &&
        currentHeight > 0
      ) {
        const currentRatio = currentWidth / currentHeight;
        let matchedPreset = false;
        for (const option of aspectRatioPresetSelect.options) {
          if (
            option.value &&
            option.value !== "original" &&
            option.value !== ""
          ) {
            if (Math.abs(parseFloat(option.value) - currentRatio) < 0.01) {
              aspectRatioPresetSelect.value = option.value;
              matchedPreset = true;
              break;
            }
          } else if (
            option.value === "original" &&
            Math.abs(originalAspectRatio - currentRatio) < 0.01
          ) {
            aspectRatioPresetSelect.value = "original";
            matchedPreset = true;
            break;
          }
        }
        if (!matchedPreset) aspectRatioPresetSelect.value = "";
      }
    }
    isUserManuallyEditingDimension = false;
  }
  function handleLockToggle() {
    if (lockAspectRatioCheckbox.checked && originalImageObject) {
      const widthVal = parseInt(newWidthInput.value, 10);
      if (!isNaN(widthVal) && widthVal > 0) {
        newHeightInput.value = Math.round(widthVal / originalAspectRatio);
      } else if (originalImageObject) {
        newWidthInput.value = originalImageObject.naturalWidth;
        newHeightInput.value = originalImageObject.naturalHeight;
      }
      aspectRatioPresetSelect.value = "original";
    }
  }
  function handlePresetChange() {
    const presetValue = aspectRatioPresetSelect.value;
    if (!originalImageObject || !presetValue) return;
    let targetAspectRatio =
      presetValue === "original"
        ? originalAspectRatio
        : parseFloat(presetValue);
    if (isNaN(targetAspectRatio)) return;
    const currentWidth = parseInt(newWidthInput.value, 10);
    if (!isNaN(currentWidth) && currentWidth > 0) {
      newHeightInput.value = Math.round(currentWidth / targetAspectRatio);
    } else if (originalImageObject) {
      newWidthInput.value = originalImageObject.naturalWidth;
      newHeightInput.value = Math.round(
        originalImageObject.naturalWidth / targetAspectRatio
      );
    }
    if (!lockAspectRatioCheckbox.checked)
      lockAspectRatioCheckbox.checked = true;
  }
  function handleResizeModeChange() {
    const selectedMode = document.querySelector(
      'input[name="resizeMode"]:checked'
    ).value;
    fitBackgroundColorDiv.style.display =
      selectedMode === "fit" ? "block" : "none";
  }

  async function handlePreviewResizeAndCompression(isInitialLoad = false) {
    if (!isInitialLoad) showSpinner("Updating preview...");
    await new Promise((resolve) => setTimeout(resolve, 10));
    try {
      if (!isInitialLoad) clearMessages();
      if (
        !originalImageObject ||
        !originalImageObject.complete ||
        originalImageObject.naturalWidth === 0
      ) {
        if (!isInitialLoad)
          displayMessage("Please upload a valid image first.", "error");
        hideSpinner();
        return; // Ensure spinner is hidden on early return
      }
      const targetWidth = parseInt(newWidthInput.value, 10);
      const targetHeight = parseInt(newHeightInput.value, 10);
      const resizeMode = document.querySelector(
        'input[name="resizeMode"]:checked'
      ).value;
      let errors = [];
      if (isNaN(targetWidth) || targetWidth <= 0)
        errors.push("Width must be positive.");
      if (isNaN(targetHeight) || targetHeight <= 0)
        errors.push("Height must be positive.");
      if (
        targetWidth > MAX_CANVAS_DIMENSION ||
        targetHeight > MAX_CANVAS_DIMENSION
      )
        errors.push(`Dimensions exceed max (${MAX_CANVAS_DIMENSION}px).`);
      if (errors.length > 0) {
        if (!isInitialLoad) displayMessage(errors, "error");
        hideSpinner();
        return; // Ensure spinner is hidden
      }
      const procCtx = processingCanvas.getContext("2d");
      processingCanvas.width = targetWidth;
      processingCanvas.height = targetHeight;
      procCtx.clearRect(0, 0, targetWidth, targetHeight);
      procCtx.imageSmoothingQuality = "high";
      procCtx.imageSmoothingEnabled = true;
      if (resizeMode === "stretch") {
        procCtx.drawImage(originalImageObject, 0, 0, targetWidth, targetHeight);
      } else if (resizeMode === "fit") {
        procCtx.fillStyle = fitBackgroundColorInput.value || "#FFFFFF";
        procCtx.fillRect(0, 0, targetWidth, targetHeight);
        const imgAspectRatio =
          originalImageObject.naturalWidth / originalImageObject.naturalHeight;
        let drawWidth, drawHeight, offsetX, offsetY;
        if (targetWidth / targetHeight > imgAspectRatio) {
          drawHeight = targetHeight;
          drawWidth = drawHeight * imgAspectRatio;
          offsetX = (targetWidth - drawWidth) / 2;
          offsetY = 0;
        } else {
          drawWidth = targetWidth;
          drawHeight = drawWidth / imgAspectRatio;
          offsetX = 0;
          offsetY = (targetHeight - drawHeight) / 2;
        }
        procCtx.drawImage(
          originalImageObject,
          offsetX,
          offsetY,
          drawWidth,
          drawHeight
        );
      } else if (resizeMode === "expand") {
        const imgAspectRatio =
          originalImageObject.naturalWidth / originalImageObject.naturalHeight;
        const canvasAspectRatio = targetWidth / targetHeight;
        let sx, sy, sWidth, sHeight;
        if (imgAspectRatio > canvasAspectRatio) {
          sHeight = originalImageObject.naturalHeight;
          sWidth = sHeight * canvasAspectRatio;
          sx = (originalImageObject.naturalWidth - sWidth) / 2;
          sy = 0;
        } else {
          sWidth = originalImageObject.naturalWidth;
          sHeight = sWidth / canvasAspectRatio;
          sx = 0;
          sy = (originalImageObject.naturalHeight - sHeight) / 2;
        }
        sWidth = Math.max(1, sWidth);
        sHeight = Math.max(1, sHeight);
        sx = Math.max(0, sx);
        sy = Math.max(0, sy);
        procCtx.drawImage(
          originalImageObject,
          sx,
          sy,
          sWidth,
          sHeight,
          0,
          0,
          targetWidth,
          targetHeight
        );
      }

      isWatermarkEffectAppliedToProcessingCanvas = false;
      updateResizedCanvasPreviewFromProcessing();
      updateEstimatedFileSize();

      outputSection.style.display = "block";
      allAnimatedSections.forEach((s) => {
        if (s.id === "outputSection") {
          s.style.opacity = "1";
          s.style.transform = "translateY(0)";
        }
      });

      downloadButton.disabled = false;
      outputInfo.textContent = `Preview ready: ${targetWidth}px × ${targetHeight}px (${resizeMode}).`;
      if (!isInitialLoad) {
        displayMessage("Preview updated successfully!", "success");
        playSuccessSound();
        showSuccessIndicator();
      }
    } catch (error) {
      console.error("Error during resize/compression preview:", error);
      if (!isInitialLoad)
        displayMessage(
          `Preview Error: ${error.message}. Try smaller dimensions.`,
          "error"
        );
      downloadButton.disabled = true;
    } finally {
      if (!isInitialLoad) hideSpinner();
    }
  }

  function updateResizedCanvasPreviewFromProcessing() {
    if (!processingCanvas.width || !processingCanvas.height) return;
    const previewCtx = resizedCanvasPreview.getContext("2d");
    let displayWidth = processingCanvas.width;
    let displayHeight = processingCanvas.height;
    if (
      displayWidth > MAX_PREVIEW_DIMENSION ||
      displayHeight > MAX_PREVIEW_DIMENSION
    ) {
      const aspectRatio = displayWidth / displayHeight;
      if (aspectRatio >= 1) {
        displayWidth = MAX_PREVIEW_DIMENSION;
        displayHeight = MAX_PREVIEW_DIMENSION / aspectRatio;
      } else {
        displayHeight = MAX_PREVIEW_DIMENSION;
        displayWidth = MAX_PREVIEW_DIMENSION * aspectRatio;
      }
    }
    resizedCanvasPreview.width = processingCanvas.width;
    resizedCanvasPreview.height = processingCanvas.height;
    resizedCanvasPreview.style.width = `${Math.round(displayWidth)}px`;
    resizedCanvasPreview.style.height = `${Math.round(displayHeight)}px`;
    previewCtx.imageSmoothingQuality = "medium";
    previewCtx.clearRect(
      0,
      0,
      resizedCanvasPreview.width,
      resizedCanvasPreview.height
    );
    previewCtx.drawImage(processingCanvas, 0, 0);
    resizedCanvasPreview.style.display = "block";
    resizedPreviewPlaceholder.style.display = "none";
  }
  function updateEstimatedFileSize() {
    if (!processingCanvas.width || !processingCanvas.height) {
      estimatedFileSizeDisplay.textContent = "";
      return;
    }
    const quality = parseFloat(compressionQualityRange.value) / 100;
    let mimeType = originalFileMimeType;
    if (!["image/jpeg", "image/webp"].includes(mimeType)) {
      mimeType = "image/png";
    }
    try {
      const dataURL = processingCanvas.toDataURL(
        mimeType,
        ["image/jpeg", "image/webp"].includes(mimeType) ? quality : undefined
      );
      const fileSizeKB = (atob(dataURL.split(",")[1]).length / 1024).toFixed(1);
      estimatedFileSizeDisplay.textContent = `Est. Size: ~${fileSizeKB} KB (Quality: ${compressionQualityRange.value}%)`;
    } catch (e) {
      console.error("Error estimating file size:", e);
      estimatedFileSizeDisplay.textContent = "Error estimating size.";
    }
  }
  async function handleImageDownload() {
    showSpinner("Preparing download...");
    await new Promise((resolve) => setTimeout(resolve, 50));
    try {
      if (
        !processingCanvas.width ||
        !processingCanvas.height ||
        downloadButton.disabled
      ) {
        displayMessage("No valid image processed to download.", "error");
        hideSpinner();
        return;
      }
      const quality = parseFloat(compressionQualityRange.value) / 100;
      let mimeType = originalFileMimeType;
      let downloadExtension = originalFileName.split(".").pop().toLowerCase();
      if (!["jpg", "jpeg", "webp", "png"].includes(downloadExtension)) {
        downloadExtension = "png";
      }
      if (downloadExtension === "jpg") downloadExtension = "jpeg";
      if (downloadExtension === "jpeg") {
        mimeType = "image/jpeg";
      } else if (
        downloadExtension === "webp" &&
        processingCanvas.toDataURL("image/webp").startsWith("data:image/webp")
      ) {
        mimeType = "image/webp";
      } else {
        mimeType = "image/png";
        downloadExtension = "png";
      }
      const baseName =
        originalFileName.substring(0, originalFileName.lastIndexOf(".")) ||
        originalFileName;
      const downloadFileName = `PixelBoost_${baseName}_${
        processingCanvas.width
      }x${processingCanvas.height}${
        isWatermarkEffectAppliedToProcessingCanvas ? "_WMFree" : ""
      }.${downloadExtension}`;
      const dataURL = processingCanvas.toDataURL(
        mimeType,
        ["image/jpeg", "image/webp"].includes(mimeType) ? quality : undefined
      );
      const link = document.createElement("a");
      link.href = dataURL;
      link.download = downloadFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      outputInfo.textContent = `Image downloaded as ${downloadFileName}. Thank you for using PixelBoost!`;
      displayMessage(
        "Download initiated! Check your downloads folder.",
        "success"
      );
      playSuccessSound();
      showSuccessIndicator();
    } catch (error) {
      console.error("Error during download:", error);
      displayMessage(`Download failed: ${error.message}.`, "error");
    } finally {
      hideSpinner();
    }
  }

  function resetFullInterface() {
    showSpinner("Resetting...");
    imageUpload.value = "";
    fileNameDisplay.textContent = "";
    imagePreview.style.display = "none";
    imagePreview.src = "#";
    previewPlaceholder.style.display = "block";
    watermarkSelectionCanvas.style.display = "none";
    if (watermarkCtx)
      watermarkCtx.clearRect(
        0,
        0,
        watermarkSelectionCanvas.width,
        watermarkSelectionCanvas.height
      );
    watermarkRectOriginalCoords.active = false;
    watermarkSelectionInfo.textContent = "Drag on image to select watermark.";
    isWatermarkEffectAppliedToProcessingCanvas = false;

    mainControlsSection.style.display = "none";
    outputSection.style.display = "none";
    allAnimatedSections.forEach((s) => {
      if (s.id === "mainControlsSection" || s.id === "outputSection") {
        s.style.opacity = "0";
        s.style.transform = "translateY(20px)";
      }
    });

    tabButtons.forEach((btn) => btn.classList.remove("active"));
    tabContents.forEach((content) => content.classList.remove("active"));
    tabButtons[0].classList.add("active");
    tabContents[0].classList.add("active");

    newWidthInput.value = "";
    newHeightInput.value = "";
    lockAspectRatioCheckbox.checked = true;
    aspectRatioPresetSelect.value = "";
    document.querySelector(
      'input[name="resizeMode"][value="stretch"]'
    ).checked = true;
    fitBackgroundColorDiv.style.display = "none";
    fitBackgroundColorInput.value = "#FFFFFF";
    compressionQualityRange.value = "92";
    compressionQualityValueDisplay.textContent = "92";

    if (resizedCanvasPreview.getContext("2d"))
      resizedCanvasPreview
        .getContext("2d")
        .clearRect(
          0,
          0,
          resizedCanvasPreview.width,
          resizedCanvasPreview.height
        );
    resizedCanvasPreview.style.display = "none";
    resizedPreviewPlaceholder.style.display = "block";
    downloadButton.disabled = true;
    outputInfo.textContent = "";
    estimatedFileSizeDisplay.textContent = "";
    successIndicator.style.display = "none";
    originalImageObject = null;
    originalAspectRatio = 1;
    originalFileMimeType = "image/png";
    clearMessages();
    setTimeout(hideSpinner, 50);
  }
  function displayMessage(messages, type = "error") {
    messagesDiv.innerHTML = "";
    messagesDiv.className = "messages-container";
    messagesDiv.classList.add(type);
    if (!Array.isArray(messages)) messages = [messages];
    const ul = document.createElement("ul");
    messages.forEach((msgText) => {
      const li = document.createElement("li");
      li.textContent = msgText;
      ul.appendChild(li);
    });
    messagesDiv.appendChild(ul);
    messagesDiv.style.display = "block";
    messagesDiv.style.opacity = 0;
    requestAnimationFrame(() => (messagesDiv.style.opacity = 1));
  }
  function clearMessages() {
    messagesDiv.style.opacity = 0;
    setTimeout(() => {
      messagesDiv.innerHTML = "";
      messagesDiv.style.display = "none";
    }, 250);
  }

  // Initial UI setup
  resetFullInterface();

  const rootStyle = getComputedStyle(document.documentElement);
  document.documentElement.style.setProperty(
    "--primary-color-rgb",
    extractRgb(rootStyle.getPropertyValue("--primary-color").trim())
  );
  document.documentElement.style.setProperty(
    "--secondary-color-rgb",
    extractRgb(rootStyle.getPropertyValue("--secondary-color").trim())
  );
  document.documentElement.style.setProperty(
    "--accent-color-rgb",
    extractRgb(rootStyle.getPropertyValue("--accent-color").trim())
  );

  function extractRgb(colorStr) {
    if (colorStr.startsWith("#")) {
      let hex = colorStr.substring(1);
      if (hex.length === 3) {
        // Expand shorthand hex
        hex = hex
          .split("")
          .map((char) => char + char)
          .join("");
      }
      const bigint = parseInt(hex, 16);
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      return `${r}, ${g}, ${b}`;
    } else if (colorStr.startsWith("rgb")) {
      const match = colorStr.match(
        /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/
      );
      if (match) {
        return `${match[1]}, ${match[2]}, ${match[3]}`;
      }
    }
    console.warn("Could not parse RGB from color string:", colorStr);
    return "0,0,0"; // Fallback
  }
});
