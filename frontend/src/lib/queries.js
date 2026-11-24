import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, qs } from "./api.js";

// Shared storefront queries. React Query caches these so pages load instantly
// on repeat visits and retry automatically on flaky connections.

export const useSettings = () =>
  useQuery({ queryKey: ["settings"], queryFn: () => api("/api/settings").then((d) => d.settings), staleTime: 5 * 60_000 });

export const useCategories = () =>
  useQuery({ queryKey: ["categories"], queryFn: () => api("/api/categories").then((d) => d.categories), staleTime: 5 * 60_000 });

export const useBrands = () =>
  useQuery({ queryKey: ["brands"], queryFn: () => api("/api/brands").then((d) => d.brands), staleTime: 5 * 60_000 });

export const useProducts = (params) =>
  useQuery({
    queryKey: ["products", params],
    queryFn: ({ signal }) => api(`/api/products${qs(params)}`, { signal }),
    placeholderData: keepPreviousData,
  });

export const useProduct = (slug) =>
  useQuery({ queryKey: ["product", slug], queryFn: () => api(`/api/products/${encodeURIComponent(slug)}`), enabled: Boolean(slug) });
