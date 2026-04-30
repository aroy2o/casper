import { useEffect, useState } from "react";
import { useTranslation } from "../hooks/useTranslation";

interface TransTextProps {
  text: string;
}

export const TransText = ({ text }: TransTextProps): JSX.Element => {
  const { t, currentLanguage } = useTranslation();
  const [value, setValue] = useState(text);

  useEffect(() => {
    let mounted = true;
    void t(text).then((next) => {
      if (mounted) setValue(next);
    });
    return () => {
      mounted = false;
    };
  }, [text, t, currentLanguage]);

  return <>{value}</>;
};
