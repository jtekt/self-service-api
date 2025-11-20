import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFoud() {
  return (
    <Empty className="flex flex-1 flex-col justify-center">
      <EmptyHeader>
        <EmptyTitle>404 - Not Found</EmptyTitle>
        <EmptyDescription>
          The page you&apos;re looking for doesn&apos;t exist.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link href="/">
          <Button>Homepage</Button>
        </Link>
      </EmptyContent>
    </Empty>
  );
}
