import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Language } from "../types";


interface FeatureBoundaryProps {
  children: React.ReactNode;
  language: Language;
  featureName: string;
}

interface FeatureBoundaryState {
  hasError: boolean;
}

export class FeatureBoundary extends React.Component<
  FeatureBoundaryProps,
  FeatureBoundaryState
> {
  declare readonly props: FeatureBoundaryProps;
  state: FeatureBoundaryState = { hasError: false };

  static getDerivedStateFromError(): FeatureBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    console.error(`Không tải được ${this.props.featureName}:`, error);
  }

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;
    const { language, featureName } = this.props;
    return (
      <div className="m-4 flex min-h-40 flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center dark:border-rose-800 dark:bg-rose-950/30">
        <AlertTriangle className="h-6 w-6 text-rose-600" />
        <p className="mt-2 text-sm font-bold text-rose-800 dark:text-rose-200">
          {language === "VI"
            ? `Không tải được ${featureName}`
            : `Could not load ${featureName}`}
        </p>
        <p className="mt-1 text-xs text-rose-700/80 dark:text-rose-300/80">
          {language === "VI"
            ? "Kết nối có thể bị gián đoạn hoặc phiên bản mới vừa được cập nhật."
            : "The connection may be interrupted or a new version was deployed."}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700"
        >
          <RefreshCw className="h-4 w-4" />
          {language === "VI" ? "Tải lại ứng dụng" : "Reload app"}
        </button>
      </div>
    );
  }
}
