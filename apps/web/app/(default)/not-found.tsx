import NotFoundView from "@/components/not-found-view";

/* 英文首页分组的 404。使用 app/(default)/layout.tsx 作为 root layout。 */
export default function NotFound() {
  return <NotFoundView lang="en" />;
}
