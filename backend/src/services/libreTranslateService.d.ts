import { EventEmitter } from "node:events";

export function startLibreTranslate(): Promise<void>;
export function isLibreTranslateReady(): boolean;
export function stopLibreTranslate(): Promise<void>;
export const libreTranslateEvents: EventEmitter;
