import { TooltipProvider } from '@/components/ui/tooltip';
import { Layout } from './Layout';
import { MainContent } from './MainContent';
import { useThemeEffect } from './useTheme';
import { useSpecParser } from '@/features/editor/hooks/useSpecParser';
import { useGraphBuilder } from '@/features/graph/hooks/useGraphBuilder';

function App() {
  useThemeEffect();
  useSpecParser();
  useGraphBuilder();

  return (
    <TooltipProvider>
      <Layout>
        <MainContent />
      </Layout>
    </TooltipProvider>
  );
}

export default App;
