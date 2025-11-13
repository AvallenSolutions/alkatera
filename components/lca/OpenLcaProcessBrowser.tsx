'use client';

import { useState, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { supabase } from '@/lib/supabaseClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Database, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface OpenLcaProcess {
  id: string;
  name: string;
  category: string;
}

interface OpenLcaProcessBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onProcessSelect: (process: OpenLcaProcess) => void;
}

export function OpenLcaProcessBrowser({
  isOpen,
  onClose,
  onProcessSelect,
}: OpenLcaProcessBrowserProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<OpenLcaProcess[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (debouncedSearchTerm.trim().length < 3) {
      setResults([]);
      setError(null);
      setIsMockData(false);
      return;
    }

    const searchOpenLca = async () => {
      setIsLoading(true);
      setError(null);
      setIsMockData(false);

      try {
        const { data: session } = await supabase.auth.getSession();

        if (!session.session) {
          throw new Error('You must be logged in');
        }

        const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/query-openlca-processes`;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ searchTerm: debouncedSearchTerm }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to search OpenLCA database');
        }

        const data = await response.json();
        setResults(data.results || []);
        setIsMockData(data.mock || false);

        // Log environment information for debugging
        if (data.environment) {
          console.log(`OpenLCA Environment: ${data.environment} | Host: ${data.host}`);
        }
      } catch (err: any) {
        console.error('Error searching OpenLCA:', err);

        // Check if this is a connection error to local OpenLCA
        const errorMessage = err.message || 'Failed to search OpenLCA database';
        if (errorMessage.includes('local OpenLCA')) {
          setError('Cannot connect to local OpenLCA server. Please start OpenLCA desktop app and enable IPC server on port 8080.');
        } else {
          setError(errorMessage);
        }
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    searchOpenLca();
  }, [debouncedSearchTerm]);

  const handleProcessClick = (process: OpenLcaProcess) => {
    onProcessSelect(process);
    setSearchTerm('');
    setResults([]);
    onClose();
  };

  const handleClose = () => {
    setSearchTerm('');
    setResults([]);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Search OpenLCA Database</DialogTitle>
          <DialogDescription>
            Search for processes from the OpenLCA database to add as platform estimates
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 flex flex-col min-h-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search processes (e.g., 'glass bottle', 'electricity grid')..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>

          {isMockData && (
            <Alert>
              <Database className="h-4 w-4" />
              <AlertDescription>
                OpenLCA API is not configured. Showing mock data for demonstration.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {searchTerm.trim().length > 0 && searchTerm.trim().length < 3 && (
            <p className="text-sm text-muted-foreground text-centre py-8">
              Please enter at least 3 characters to search
            </p>
          )}

          {isLoading && (
            <div className="flex items-centre justify-centre py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && debouncedSearchTerm.trim().length >= 3 && results.length === 0 && !error && (
            <div className="flex flex-col items-centre justify-centre py-12 text-centre">
              <Database className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                No processes found for &quot;{debouncedSearchTerm}&quot;
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Try a different search term or check your spelling
              </p>
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <ScrollArea className="flex-1 border rounded-lg">
              <div className="p-2 space-y-1">
                {results.map((process) => (
                  <Button
                    key={process.id}
                    variant="ghost"
                    className="w-full justify-start h-auto py-3 px-4 hover:bg-muted/50"
                    onClick={() => handleProcessClick(process)}
                  >
                    <div className="flex flex-col items-start gap-1 w-full">
                      <div className="font-medium text-sm text-left">{process.name}</div>
                      <Badge variant="outline" className="text-xs font-normal">
                        {process.category}
                      </Badge>
                    </div>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
