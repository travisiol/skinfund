"use client";

import { useId, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { skinArt } from "@/config/site";
import { DEFAULT_QUERY, isSelectable, searchSkins, STATUS_LABEL, unavailableReason } from "@/core/catalogue";
import type { Availability, CatalogueQuery, PriceBand, SortKey } from "@/core/catalogue";
import type { Skin } from "@/core/types";
import { useCatalogue } from "@/lib/client-data";
import { formatDate, formatRp } from "@/lib/format";
import { AngularButton } from "./AngularButton";

const PAGE = 12;

const PRICE: { value: PriceBand; label: string }[] = [
  { value: "any", label: "Any price" },
  { value: "to975", label: "Up to 975 RP" },
  { value: "1350", label: "1,350 RP" },
  { value: "1820", label: "1,820 RP" },
  { value: "3250plus", label: "Above 1,820 RP" },
];
const SORT: { value: SortKey; label: string }[] = [
  { value: "champion", label: "Champion A–Z" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "newest", label: "Newest first" },
];

function Tile({ skin, selected, onSelect }: { skin: Skin; selected: boolean; onSelect: (skin: Skin) => void }) {
  const art = skinArt(skin, "portrait");
  const reason = unavailableReason(skin);
  return (
    <li
      className="frame flex flex-col"
      style={{ "--c": "14px", "--edge": selected ? "var(--color-teal)" : "var(--color-gold)", "--bw": selected ? "2px" : "1px" } as CSSProperties}
    >
      <div className="cut relative m-[5px] aspect-[308/400] overflow-hidden bg-night" style={{ "--c": "11px" } as CSSProperties}>
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element -- hot-linked from the asset CDN, not re-hosted or optimised
          <img
            src={art}
            alt={`${skin.name} artwork`}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className={`absolute inset-0 size-full object-cover object-top ${reason ? "opacity-45 grayscale" : ""}`}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(160deg,#1a3344_0%,#0c1c27_100%)] p-3 text-center">
            <span className="eyebrow leading-relaxed">
              {skin.champion}
              <span className="mt-1 block text-[0.625rem] text-mist normal-case">artwork not enabled</span>
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 pt-2 pb-4">
        <div>
          <h3 className="text-lg leading-snug font-semibold text-ivory">{skin.name}</h3>
          <p className="text-[0.9375rem] text-mist">{skin.champion}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="num text-[0.9375rem] text-teal">{skin.rp !== null ? formatRp(skin.rp) : "No RP price"}</span>
          <span className={`chip ${reason ? "chip-warn" : ""}`}>{STATUS_LABEL[skin.status]}</span>
        </div>
        {reason && <p className="text-sm leading-snug text-mist">{reason}</p>}
        <div className="mt-auto pt-2">
          {reason ? (
            <AngularButton variant="outline" size="sm" className="w-full" disabled aria-label={`${skin.name} cannot be selected`}>
              Not available
            </AngularButton>
          ) : (
            <AngularButton
              variant={selected ? "primary" : "outline"}
              size="sm"
              className="w-full"
              aria-pressed={selected}
              aria-label={selected ? `${skin.name} is selected` : `Select ${skin.name}`}
              onClick={() => onSelect(skin)}
            >
              {selected ? "Selected" : "Select skin"}
            </AngularButton>
          )}
        </div>
      </div>
    </li>
  );
}

/** Search and filters over the real catalogue snapshot. Every card is a real skin with its listed price. */
export function SkinSearch({ selectedId, onSelect }: { selectedId: number | null; onSelect: (skin: Skin) => void }) {
  const catalogue = useCatalogue();
  const [query, setQuery] = useState<CatalogueQuery>(DEFAULT_QUERY);
  const [limit, setLimit] = useState(PAGE);
  const id = useId();

  const results = useMemo(() => (catalogue.data ? searchSkins(catalogue.data.skins, query) : []), [catalogue.data, query]);
  const update = (patch: Partial<CatalogueQuery>) => {
    setQuery((current) => ({ ...current, ...patch }));
    setLimit(PAGE);
  };

  if (catalogue.error)
    return (
      <p role="alert" className="notice">
        The skin catalogue could not be loaded. Reload the page to try again.
      </p>
    );

  const selectableCount = catalogue.data ? catalogue.data.skins.filter(isSelectable).length : 0;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <div className="sm:col-span-2 lg:col-span-1">
          <label htmlFor={`${id}-q`} className="eyebrow mb-1.5 block">
            Search
          </label>
          <input
            id={`${id}-q`}
            type="search"
            className="field"
            placeholder="Champion or skin name"
            autoComplete="off"
            value={query.text}
            onChange={(event) => update({ text: event.target.value })}
          />
        </div>
        <div>
          <label htmlFor={`${id}-a`} className="eyebrow mb-1.5 block">
            Availability
          </label>
          <select id={`${id}-a`} className="field" value={query.availability} onChange={(event) => update({ availability: event.target.value as Availability })}>
            <option value="selectable">In store for RP</option>
            <option value="all">All skins</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-p`} className="eyebrow mb-1.5 block">
            Price
          </label>
          <select id={`${id}-p`} className="field" value={query.price} onChange={(event) => update({ price: event.target.value as PriceBand })}>
            {PRICE.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-s`} className="eyebrow mb-1.5 block">
            Sort
          </label>
          <select id={`${id}-s`} className="field" value={query.sort} onChange={(event) => update({ sort: event.target.value as SortKey })}>
            {SORT.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mt-4 text-[0.9375rem] text-mist" aria-live="polite">
        {catalogue.data ? (
          <>
            <span className="num text-ivory">{results.length.toLocaleString("en-US")}</span> {results.length === 1 ? "skin" : "skins"}
            {query.availability === "selectable" && <> of {selectableCount.toLocaleString("en-US")} sold for RP in the store</>}
          </>
        ) : (
          "Loading the catalogue…"
        )}
      </p>

      {catalogue.data && results.length === 0 && (
        <p className="notice mt-4">
          No skin matches. Check the spelling, or switch Availability to “All skins” to see skins that are not sold for RP.
        </p>
      )}

      <ul className="mt-5 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {results.slice(0, limit).map((skin) => (
          <Tile key={skin.id} skin={skin} selected={skin.id === selectedId} onSelect={onSelect} />
        ))}
      </ul>

      {results.length > limit && (
        <div className="mt-8 text-center">
          <AngularButton variant="outline" onClick={() => setLimit((n) => n + PAGE * 2)}>
            Show more skins
          </AngularButton>
        </div>
      )}

      {catalogue.data && (
        <p className="mt-6 text-sm text-mist">
          Names from {catalogue.data.meta.nameSource} {catalogue.data.meta.dataDragonVersion}. Prices and availability from{" "}
          {catalogue.data.meta.pricingSource}, snapshot of {formatDate(catalogue.data.meta.generatedAt)}. Prices are listed store prices and can
          change; the price at claim time is what counts.
        </p>
      )}
    </div>
  );
}
