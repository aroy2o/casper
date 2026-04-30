import { type ReactNode, useEffect, useRef } from "react";
import { useAppSelector } from "../../app/hooks";

interface AutoTranslateProviderProps {
  children: ReactNode;
}

type BatchPayload = {
  translations?: string[];
};

type NodeMeta = {
  original: string;
  lastLang: string;
  lastTranslated: string;
};

type AttrMeta = {
  original: string;
  lastLang: string;
  lastTranslated: string;
};

const CACHE_KEY_PREFIX = "casper_translations_v1";
const CACHE_LIMIT = 12000;

const hasLetters = (value: string): boolean => /[\p{L}]/u.test(value);

const shouldSkipElement = (element: Element | null): boolean => {
  if (!element) return true;
  if (element.closest("[data-no-translate='true']")) return true;
  const tag = element.tagName.toLowerCase();
  return (
    tag === "script" ||
    tag === "style" ||
    tag === "noscript" ||
    tag === "textarea" ||
    tag === "input" ||
    tag === "select" ||
    tag === "option"
  );
};

export const AutoTranslateProvider = ({ children }: AutoTranslateProviderProps): JSX.Element => {
  const currentLanguage = useAppSelector((state) => state.translation.currentLanguage);
  const nodeMetaRef = useRef<WeakMap<Text, NodeMeta>>(new WeakMap());
  const attrMetaRef = useRef<WeakMap<Element, Map<string, AttrMeta>>>(new WeakMap());
  const cacheRef = useRef<Map<string, string>>(new Map());
  const inFlightRef = useRef<Map<string, Promise<string>>>(new Map());
  const observerRef = useRef<MutationObserver | null>(null);
  const timerRef = useRef<number | null>(null);
  const translatingRef = useRef(false);
  const pendingRunRef = useRef(false);
  const hydratedLanguageRef = useRef<string | null>(null);

  const hydrateCacheForLanguage = (language: string): void => {
    if (hydratedLanguageRef.current === language) return;
    const key = `${CACHE_KEY_PREFIX}:${language}`;
    try {
      const raw = localStorage.getItem(key);
      cacheRef.current.clear();
      if (!raw) {
        hydratedLanguageRef.current = language;
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, string>;
      Object.entries(parsed).forEach(([source, translated]) => {
        cacheRef.current.set(`${language}:${source}`, translated);
      });
      hydratedLanguageRef.current = language;
    } catch {
      cacheRef.current.clear();
      hydratedLanguageRef.current = language;
    }
  };

  const persistCache = (language: string): void => {
    const key = `${CACHE_KEY_PREFIX}:${language}`;
    const entries = Array.from(cacheRef.current.entries())
      .filter(([k]) => k.startsWith(`${language}:`))
      .slice(-CACHE_LIMIT);
    const serializable: Record<string, string> = {};
    for (const [cacheKey, translated] of entries) {
      serializable[cacheKey.slice(language.length + 1)] = translated;
    }
    try {
      localStorage.setItem(key, JSON.stringify(serializable));
    } catch {
      // Ignore quota/storage failures.
    }
  };

  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;
    hydrateCacheForLanguage(currentLanguage);

    const walkTextNodes = (): Text[] => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      let current = walker.nextNode();
      while (current) {
        if (current.nodeType === Node.TEXT_NODE) {
          const textNode = current as Text;
          const raw = textNode.nodeValue ?? "";
          const trimmed = raw.trim();
          const parent = textNode.parentElement;
          if (trimmed && hasLetters(trimmed) && !shouldSkipElement(parent)) {
            nodes.push(textNode);
          }
        }
        current = walker.nextNode();
      }
      return nodes;
    };

    const translatableAttrs = ["placeholder", "title", "aria-label"] as const;

    const walkAttributeTargets = (): Array<{ element: Element; attr: (typeof translatableAttrs)[number]; value: string }> => {
      const elements = Array.from(root.querySelectorAll("*"));
      const targets: Array<{ element: Element; attr: (typeof translatableAttrs)[number]; value: string }> = [];
      for (const element of elements) {
        if (shouldSkipElement(element)) continue;
        for (const attr of translatableAttrs) {
          const value = element.getAttribute(attr);
          if (value && value.trim() && hasLetters(value)) {
            targets.push({ element, attr, value });
          }
        }
      }
      return targets;
    };

    const restoreEnglish = () => {
      const nodes = walkTextNodes();
      for (const node of nodes) {
        const meta = nodeMetaRef.current.get(node);
        if (meta) {
          node.nodeValue = meta.original;
          nodeMetaRef.current.set(node, {
            original: meta.original,
            lastLang: "en",
            lastTranslated: meta.original
          });
        }
      }

      const targets = walkAttributeTargets();
      for (const { element, attr } of targets) {
        const attrMap = attrMetaRef.current.get(element);
        const meta = attrMap?.get(attr);
        if (!meta) continue;
        element.setAttribute(attr, meta.original);
        attrMap?.set(attr, {
          original: meta.original,
          lastLang: "en",
          lastTranslated: meta.original
        });
      }
    };

    const processNodes = async () => {
      if (translatingRef.current) {
        pendingRunRef.current = true;
        return;
      }
      if (currentLanguage === "en") {
        restoreEnglish();
        return;
      }

      const nodes = walkTextNodes();
      const attrs = walkAttributeTargets();
      const pendingTextSet = new Set<string>();
      const nodeToSource = new Map<Text, string>();
      const attrToSource: Array<{ element: Element; attr: string; source: string }> = [];

      for (const node of nodes) {
        const currentText = node.nodeValue ?? "";
        const meta = nodeMetaRef.current.get(node);
        const source = meta?.original ?? currentText;
        if (!source.trim() || !hasLetters(source)) continue;

        if (meta?.lastLang === currentLanguage && meta.lastTranslated === currentText) {
          continue;
        }

        nodeToSource.set(node, source);
        const cacheKey = `${currentLanguage}:${source}`;
        if (!cacheRef.current.has(cacheKey)) {
          pendingTextSet.add(source);
        }
      }

      for (const { element, attr, value } of attrs) {
        const attrMap = attrMetaRef.current.get(element) ?? new Map<string, AttrMeta>();
        const meta = attrMap.get(attr);
        const source = meta?.original ?? value;
        if (!source.trim() || !hasLetters(source)) continue;
        if (meta?.lastLang === currentLanguage && meta.lastTranslated === value) continue;
        attrToSource.push({ element, attr, source });
        attrMap.set(attr, meta ?? { original: source, lastLang: "en", lastTranslated: source });
        attrMetaRef.current.set(element, attrMap);
        const cacheKey = `${currentLanguage}:${source}`;
        if (!cacheRef.current.has(cacheKey)) {
          pendingTextSet.add(source);
        }
      }

      const pendingTexts = Array.from(pendingTextSet);
      if (pendingTexts.length === 0 && nodeToSource.size === 0 && attrToSource.length === 0) {
        return;
      }

      translatingRef.current = true;
      try {
        const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

        for (let i = 0; i < pendingTexts.length; i += 40) {
          const batch = pendingTexts.slice(i, i + 40);
          const uncached = batch.filter((src) => !inFlightRef.current.has(`${currentLanguage}:${src}`));
          if (uncached.length > 0) {
            const requestPromise = fetch(`${apiBase}/api/translate/batch`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                texts: uncached,
                targetLang: currentLanguage,
                sourceLang: "auto"
              })
            })
              .then(async (response) => {
                const payload = (await response.json()) as BatchPayload;
                const translations = payload.translations ?? [];
                uncached.forEach((src, idx) => {
                  const translated = translations[idx] ?? src;
                  cacheRef.current.set(`${currentLanguage}:${src}`, translated);
                });
                persistCache(currentLanguage);
                return "";
              })
              .finally(() => {
                uncached.forEach((src) => {
                  inFlightRef.current.delete(`${currentLanguage}:${src}`);
                });
              });

            uncached.forEach((src) => {
              inFlightRef.current.set(`${currentLanguage}:${src}`, requestPromise.then(() => cacheRef.current.get(`${currentLanguage}:${src}`) ?? src));
            });
          }

          const waitFor = batch.map((src) => inFlightRef.current.get(`${currentLanguage}:${src}`));
          await Promise.all(waitFor);
        }

        for (const [node, source] of nodeToSource.entries()) {
          const translated = cacheRef.current.get(`${currentLanguage}:${source}`) ?? source;
          node.nodeValue = translated;
          nodeMetaRef.current.set(node, {
            original: source,
            lastLang: currentLanguage,
            lastTranslated: translated
          });
        }

        for (const { element, attr, source } of attrToSource) {
          const translated = cacheRef.current.get(`${currentLanguage}:${source}`) ?? source;
          element.setAttribute(attr, translated);
          const attrMap = attrMetaRef.current.get(element) ?? new Map<string, AttrMeta>();
          attrMap.set(attr, {
            original: source,
            lastLang: currentLanguage,
            lastTranslated: translated
          });
          attrMetaRef.current.set(element, attrMap);
        }
      } catch {
        // Silent fallback keeps original UI text visible.
      } finally {
        translatingRef.current = false;
        if (pendingRunRef.current) {
          pendingRunRef.current = false;
          void processNodes();
        }
      }
    };

    const schedule = () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        void processNodes();
      }, 0);
    };

    observerRef.current?.disconnect();
    observerRef.current = new MutationObserver(() => {
      if (!translatingRef.current) {
        schedule();
      }
    });
    observerRef.current.observe(root, {
      subtree: true,
      childList: true,
      characterData: true
    });

    schedule();

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [currentLanguage]);

  return <>{children}</>;
};
