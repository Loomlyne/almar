import { rewriteHomeAmounts, type FxRates, type SelectedCurrency } from "../../lib/fx/rates";

/**
 * A published price line, converted when it can be and printed as published when it cannot.
 *
 * No choice yet (`selected` null) or no rates (`rates` null): the text is unchanged. Otherwise the
 * written amounts in it are converted with rewriteHomeAmounts. The result sits in a <bdi> with
 * tabular figures so a Latin amount stays whole inside right-to-left text; Arabic gets Western
 * numerals from lib/fx/rates.
 */
export function Amount({
  text,
  selected,
  rates,
  locale,
}: {
  text: string;
  selected: SelectedCurrency | null;
  rates: FxRates | null;
  locale: "en" | "ar" | "es";
}) {
  const shown = selected && rates ? rewriteHomeAmounts(text, selected, rates, locale) : text;
  return <bdi className="tabular-nums">{shown}</bdi>;
}
