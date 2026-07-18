import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Section } from "@astryxdesign/core/Section";
import { Spinner } from "@astryxdesign/core/Spinner";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowPathIcon, CodeBracketIcon, CommandLineIcon, ShieldCheckIcon } from "../icons.ts";
import { unwrap } from "../session/reader-api.ts";
import { api } from "../treaty.ts";

type McpSettingsDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

const claudeCodeSnippet = (url: string, token: string) =>
  `claude mcp add --transport http mdreadr ${url} --header "Authorization: Bearer ${token}"`;

const jsonConfigSnippet = (url: string, token: string) =>
  JSON.stringify(
    {
      mcpServers: {
        mdreadr: {
          type: "http",
          url,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  );

export function McpSettingsDialog({ isOpen, onOpenChange }: McpSettingsDialogProps) {
  const queryClient = useQueryClient();
  const connection = useQuery({
    queryKey: ["mcp-connection"],
    queryFn: async () => {
      const data = unwrap(await api.mcp.connection.get());
      if ("error" in data) throw new Error(data.error);
      return data;
    },
    enabled: isOpen,
  });

  const revoke = useMutation({
    mutationFn: async () => {
      const data = unwrap(await api.mcp.connection.revoke.post());
      if ("error" in data) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["mcp-connection"], data);
    },
  });

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      width={440}
      maxHeight="calc(100vh - 32px)"
      position={{ top: 16, right: 16, bottom: 16 }}
    >
      <DialogHeader
        title="MCP Access"
        subtitle="Connect an agent to this document session"
        onOpenChange={onOpenChange}
      />

      {connection.isLoading && (
        <Section padding={5}>
          <Spinner size="sm" label="Loading connection info…" />
        </Section>
      )}

      {connection.isError && (
        <Section padding={5}>
          <Banner
            status="error"
            title="Could not load connection info"
            description="Is the app fully started?"
          />
        </Section>
      )}

      {connection.data && (
        <>
          <Section padding={5} dividers={["bottom"]}>
            <HStack gap={2} vAlign="center" hAlign="between">
              <HStack gap={2} vAlign="center">
                <StatusDot variant="success" label="Live" isPulsing />
                <Text type="body" weight="medium">
                  127.0.0.1
                </Text>
              </HStack>
              <Badge
                variant="success"
                label="Persists across restarts"
                icon={<Icon icon={ShieldCheckIcon} size="xsm" />}
              />
            </HStack>
          </Section>

          <Section padding={5} dividers={["bottom"]}>
            <VStack gap={3}>
              <HStack gap={2} vAlign="center">
                <Icon icon={CommandLineIcon} size="sm" color="secondary" />
                <Text type="label">Claude Code</Text>
              </HStack>
              <CodeBlock
                code={claudeCodeSnippet(connection.data.url, connection.data.token)}
                language="bash"
                hasLanguageLabel={false}
              />
            </VStack>
          </Section>

          <Section padding={5} dividers={["bottom"]}>
            <VStack gap={3}>
              <HStack gap={2} vAlign="center">
                <Icon icon={CodeBracketIcon} size="sm" color="secondary" />
                <Text type="label">Claude Desktop / Cursor / other JSON-config clients</Text>
              </HStack>
              <CodeBlock
                code={jsonConfigSnippet(connection.data.url, connection.data.token)}
                language="json"
                title="mcp.json"
              />
            </VStack>
          </Section>

          <Section padding={5}>
            <VStack gap={3}>
              <HStack gap={2} vAlign="center">
                <Button
                  label="Revoke & regenerate"
                  variant="secondary"
                  icon={<Icon icon={ArrowPathIcon} size="sm" />}
                  isLoading={revoke.isPending}
                  onClick={() => revoke.mutate()}
                />
                <Text type="supporting">Invalidates every client using this token.</Text>
              </HStack>
              {revoke.isError && <Banner status="error" title="Could not revoke token" />}
            </VStack>
          </Section>
        </>
      )}
    </Dialog>
  );
}
