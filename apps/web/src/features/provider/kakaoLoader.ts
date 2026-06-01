let kakaoScriptPromise: Promise<void> | null = null;

export function loadKakaoMaps(appKey: string): Promise<void> {
  if (!appKey) {
    return Promise.reject(new Error("Kakao JavaScript key is missing"));
  }

  if (window.kakao?.maps) {
    return Promise.resolve();
  }

  if (kakaoScriptPromise) {
    return kakaoScriptPromise;
  }

  kakaoScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-kakao-maps-sdk="true"]',
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Failed to load Kakao Maps SDK")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.dataset.kakaoMapsSdk = "true";
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
      appKey,
    )}&autoload=false`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Kakao Maps SDK"));

    document.head.appendChild(script);
  });

  return kakaoScriptPromise;
}
