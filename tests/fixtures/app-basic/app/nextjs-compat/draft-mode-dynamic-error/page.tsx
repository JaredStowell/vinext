import { draftMode } from "next/headers";

export const dynamic = "error";

export default async function DraftModeDynamicErrorPage() {
  const draft = await draftMode();
  let enableError = "missing";
  let disableError = "missing";

  try {
    draft.enable();
  } catch (error) {
    enableError = error instanceof Error ? error.message : String(error);
  }

  try {
    draft.disable();
  } catch (error) {
    disableError = error instanceof Error ? error.message : String(error);
  }

  return (
    <main>
      <h1>Draft Mode Dynamic Error</h1>
      <p id="enable-error">{enableError}</p>
      <p id="disable-error">{disableError}</p>
    </main>
  );
}
