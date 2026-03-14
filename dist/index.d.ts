type PatternType = "stripe" | "diagonal" | "crosshatch";
interface RenderOptions {
    element: string | HTMLCanvasElement;
    text: string;
    fps?: number;
    pattern?: PatternType;
    distortion?: boolean;
}
interface SecureRenderAPI {
    render(options: RenderOptions): void;
    stop(): void;
}

declare const SecureRender: SecureRenderAPI;

export { type PatternType, type RenderOptions, type SecureRenderAPI, SecureRender as default };
