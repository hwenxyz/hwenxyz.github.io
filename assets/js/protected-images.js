(function () {
  "use strict";

  const PROTECTED_PREFIX = "/assets/protected/images/";
  const ASSETS_PREFIX = "/assets/";
  const FALLBACK_NAME = "encrypted.svg";
  const FALLBACK_PATH = "/assets/images/defaults/" + FALLBACK_NAME;
  const HASH_STORAGE_KEY = "protected-images-sha512";
  const ENCRYPTION_MAGIC_V2 = "HWENC02";
  const PBKDF2_ITERATIONS = 200000;
  const SALT_LENGTH = 16;
  const NONCE_LENGTH = 12;

  const MIME_BY_EXT = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
    ".avif": "image/avif",
    ".jfif": "image/jpeg"
  };

  function getPathname(src) {
    try {
      return new URL(src, window.location.origin).pathname;
    } catch (_) {
      return "";
    }
  }

  function isProtectedImagePath(pathname) {
    return pathname.indexOf(PROTECTED_PREFIX) === 0 && !pathname.endsWith("/" + FALLBACK_NAME);
  }

  function isAssetImage(pathname) {
    return pathname.indexOf(ASSETS_PREFIX) === 0 && !pathname.endsWith("/" + FALLBACK_NAME);
  }

  function isEncryptedByConfig(pathname) {
    // Check if image is in one of the configured encryption folders
    if (!window.ENCRYPTION_CONFIG || !window.ENCRYPTION_CONFIG.enabled || !window.ENCRYPTION_CONFIG.folders) {
      return false;
    }
    const folders = window.ENCRYPTION_CONFIG.folders || [];
    for (const folder of folders) {
      const folderPath = "/" + folder.toLowerCase() + "/";
      if (pathname.toLowerCase().startsWith(folderPath)) {
        return true;
      }
    }
    return false;
  }

  async function sha512Hex(input) {
    const encoded = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-512", encoded);
    const bytes = new Uint8Array(digest);
    return Array.from(bytes)
      .map(function (byte) {
        return byte.toString(16).padStart(2, "0");
      })
      .join("");
  }

  function bytesToAscii(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; i += 1) {
      out += String.fromCharCode(bytes[i]);
    }
    return out;
  }

  // Cache: masterSaltHex+hashHex -> raw master key bytes
  const masterKeyCache = {};

  async function getOrDeriveMasterKeyBytes(hashHex, masterSaltBytes) {
    const cacheKey = hashHex + ":" + Array.from(masterSaltBytes).map(function (b) {
      return b.toString(16).padStart(2, "0");
    }).join("");
    if (!masterKeyCache[cacheKey]) {
      const passwordMaterial = new TextEncoder().encode(hashHex);
      const baseKey = await crypto.subtle.importKey("raw", passwordMaterial, "PBKDF2", false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: masterSaltBytes, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
        baseKey,
        256
      );
      masterKeyCache[cacheKey] = new Uint8Array(bits);
    }
    return masterKeyCache[cacheKey];
  }

  async function deriveFileKey(masterKeyBytes, fileSaltBytes) {
    const baseKey = await crypto.subtle.importKey("raw", masterKeyBytes, "HKDF", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: fileSaltBytes,
        info: new TextEncoder().encode("hwenc-file-key")
      },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
  }

  async function decryptPayload(buffer, hashHex) {
    const bytes = new Uint8Array(buffer);

    // V2 format: magic(7) + master_salt(16) + file_salt(16) + nonce(12) + ciphertext
    const offsetMasterSalt = ENCRYPTION_MAGIC_V2.length;
    const offsetFileSalt = offsetMasterSalt + SALT_LENGTH;
    const offsetNonce = offsetFileSalt + SALT_LENGTH;
    const offsetCipher = offsetNonce + NONCE_LENGTH;
    if (bytes.length <= offsetCipher + 16 || bytesToAscii(bytes.slice(0, ENCRYPTION_MAGIC_V2.length)) !== ENCRYPTION_MAGIC_V2) {
      throw new Error("unsupported file format");
    }
    const masterSalt = bytes.slice(offsetMasterSalt, offsetFileSalt);
    const fileSalt = bytes.slice(offsetFileSalt, offsetNonce);
    const nonce = bytes.slice(offsetNonce, offsetCipher);
    const ciphertext = bytes.slice(offsetCipher);
    const masterKeyBytes = await getOrDeriveMasterKeyBytes(hashHex, masterSalt);
    const fileKey = await deriveFileKey(masterKeyBytes, fileSalt);
    const plainBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce },
      fileKey,
      ciphertext
    );
    return new Uint8Array(plainBuffer);
  }

  function detectMime(pathname) {
    const lower = pathname.toLowerCase();
    const ext = lower.slice(lower.lastIndexOf("."));
    return MIME_BY_EXT[ext] || "application/octet-stream";
  }

  function showFallbackImage(img) {
    img.src = FALLBACK_PATH;
    const link = img.closest("a");
    if (link) {
      link.href = FALLBACK_PATH;
    }
  }

  function collectProtectedImages() {
    const all = Array.from(document.querySelectorAll("img[src]"));
    return all.filter(function (img) {
      const path = getPathname(img.getAttribute("src") || "");
      // Include images under /assets/protected/images/ or those in configured encryption folders
      return isProtectedImagePath(path) || isEncryptedByConfig(path) || img.hasAttribute("data-encrypted");
    });
  }

  function getNavbarUi() {
    const form = document.getElementById("nav-password-form");
    const input = document.getElementById("nav-password-input");
    const button = document.getElementById("nav-password-button");
    const toggleButton = document.getElementById("nav-password-toggle");

    if (!form || !input || !button || !toggleButton) {
      return null;
    }

    return {
      form: form,
      input: input,
      button: button,
      toggleButton: toggleButton
    };
  }

  function showInputForm(ui, warning) {
    ui.form.style.setProperty("display", "flex", "important");
    ui.toggleButton.style.display = "none";
    ui.button.textContent = warning ? "⚠️" : "🔒";
    ui.button.className = warning
      ? "btn btn-sm btn-outline-warning"
      : "btn btn-sm btn-outline-secondary";
    if (!warning) {
      ui.input.focus();
    }
  }

  function showUnlockedIcon(ui) {
    ui.form.style.setProperty("display", "none", "important");
    ui.toggleButton.style.display = "inline-block";
    ui.input.value = "";
  }

  async function decryptAndRender(img, hashHex) {
    const originalSrc = img.getAttribute("data-src") || img.getAttribute("src") || "";
    const sourcePath = getPathname(originalSrc);
    try {
      const response = await fetch(new URL(originalSrc, window.location.origin).href, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("request failed");
      }
      const encrypted = await response.arrayBuffer();
      const decrypted = await decryptPayload(encrypted, hashHex);
      const mime = detectMime(sourcePath);
      const blob = new Blob([decrypted], { type: mime });
      const objectUrl = URL.createObjectURL(blob);
      img.src = objectUrl;
      const link = img.closest("a");
      if (link) {
        link.href = objectUrl;
      }
    } catch (_) {
      showFallbackImage(img);
      throw new Error("decrypt failed");
    }
  }

  async function decryptAll(images, hash) {
    if (!hash || hash.length !== 128) {
      return false;
    }

    let failed = 0;
    for (const img of images) {
      try {
        await decryptAndRender(img, hash);
      } catch (_) {
        failed += 1;
      }
    }

    return failed === 0;
  }

  function resetProtectedImages(images) {
    for (const img of images) {
      showFallbackImage(img);
    }
  }

  function bootstrap() {
    const protectedImages = collectProtectedImages();
    const ui = getNavbarUi();

    if (protectedImages.length === 0) {
      if (ui) {
        ui.toggleButton.style.display = "none";
        ui.form.style.setProperty("display", "none", "important");
      }
      return;
    }

    for (const img of protectedImages) {
      if (!img.getAttribute("data-src") && img.getAttribute("src") !== FALLBACK_PATH) {
        img.setAttribute("data-src", img.getAttribute("src"));
      }
      img.src = FALLBACK_PATH;
      const link = img.closest("a");
      if (link) {
        if (!link.getAttribute("data-href")) {
          link.setAttribute("data-href", link.getAttribute("href") || "");
        }
        link.href = FALLBACK_PATH;
      }
    }

    if (!ui) {
      const cachedWithoutUi = localStorage.getItem(HASH_STORAGE_KEY);
      if (cachedWithoutUi) {
        decryptAll(protectedImages, cachedWithoutUi);
      }
      return;
    }

    // Unlock icon clicked → forget password, relock images
    ui.toggleButton.addEventListener("click", function () {
      localStorage.removeItem(HASH_STORAGE_KEY);
      resetProtectedImages(protectedImages);
      showInputForm(ui, false);
    });

    // Form submitted → try to decrypt
    ui.form.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!ui.input.value) {
        return;
      }
      const hash = await sha512Hex(ui.input.value);
      const success = await decryptAll(protectedImages, hash);
      if (success) {
        localStorage.setItem(HASH_STORAGE_KEY, hash);
        showUnlockedIcon(ui);
      } else {
        localStorage.removeItem(HASH_STORAGE_KEY);
        showInputForm(ui, true);
      }
    });

    // Check for cached hash on load
    const cachedHash = localStorage.getItem(HASH_STORAGE_KEY);
    if (cachedHash) {
      decryptAll(protectedImages, cachedHash).then(function (success) {
        if (success) {
          showUnlockedIcon(ui);
        } else {
          localStorage.removeItem(HASH_STORAGE_KEY);
          resetProtectedImages(protectedImages);
          showInputForm(ui, true);
        }
      });
    } else {
      showInputForm(ui, false);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
    return;
  }
  bootstrap();
})();
