import Box from "@cloudscape-design/components/box";
import Spinner from "@cloudscape-design/components/spinner";
export default function Loading() {
  return (
    <Box textAlign="center" padding={{ vertical: "xxl" }}>
      <Spinner size="large" /> Loading Route 53…
    </Box>
  );
}
