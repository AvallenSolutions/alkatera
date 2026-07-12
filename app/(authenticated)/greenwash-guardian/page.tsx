"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Globe,
  FileText,
  MessageSquare,
  Share2,
  Shield,
  AlertTriangle,
  Upload,
  History,
  ArrowRight,
  Info,
  List,
  Lock,
} from "lucide-react";
import { Eyebrow } from "@/components/studio/eyebrow";
import { useOrganization } from "@/lib/organizationContext";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";
import Link from "next/link";
import {
  createAssessment,
  triggerAnalysis,
  fetchUrlContent,
  fetchSocialMediaContent,
  createBulkJob,
} from "@/lib/greenwash";
import type { InputType } from "@/lib/types/greenwash";

type TabType = InputType | "bulk";

export default function GreenwashGuardianPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();

  const { hasFeature } = useSubscription();
  const canAnalyzeDocuments = hasFeature('greenwash_documents');
  const isGreenwashUnlimited = hasFeature('greenwash_unlimited');

  const [activeTab, setActiveTab] = useState<TabType>("url");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [socialMediaUrl, setSocialMediaUrl] = useState("");
  const [socialMediaText, setSocialMediaText] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [bulkUrls, setBulkUrls] = useState("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ];
      if (!validTypes.includes(file.type)) {
        toast.error("Please upload a PDF, DOCX, or TXT file");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File must be less than 10MB");
        return;
      }
      setDocumentFile(file);
    }
  };

  const handleSubmit = async () => {
    if (!currentOrganization) {
      toast.error("Please select an organisation");
      return;
    }

    // Validate input based on tab
    let content = "";
    let inputSource = "";

    // Handle bulk URLs separately
    if (activeTab === "bulk") {
      const urls = bulkUrls
        .split("\n")
        .map(u => u.trim())
        .filter(u => u.length > 0);

      if (urls.length === 0) {
        toast.error("Please enter at least one URL");
        return;
      }

      if (urls.length > 50) {
        toast.error("Maximum 50 URLs allowed per batch");
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        toast.info("Creating bulk job...");
        const job = await createBulkJob({
          urls,
          organization_id: currentOrganization.id,
          title: title.trim() || undefined,
        });
        toast.success(`Bulk job created with ${urls.length} URLs`);
        router.push(`/greenwash-guardian/bulk/${job.id}`);
      } catch (err: any) {
        console.error("Error:", err);
        setError(err.message || "An error occurred");
        toast.error(err.message || "An error occurred");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    switch (activeTab) {
      case "url":
        if (!urlInput.trim()) {
          toast.error("Please enter a URL");
          return;
        }
        inputSource = urlInput;
        break;
      case "document":
        if (!documentFile) {
          toast.error("Please upload a document");
          return;
        }
        inputSource = documentFile.name;
        break;
      case "text":
        if (!textInput.trim()) {
          toast.error("Please enter some text to analyze");
          return;
        }
        content = textInput;
        inputSource = "manual_input";
        break;
      case "social_media":
        if (!socialMediaUrl.trim() && !socialMediaText.trim()) {
          toast.error("Please enter a social media URL or paste the content");
          return;
        }
        inputSource = socialMediaUrl || "manual_input";
        break;
    }

    // Generate title if not provided
    const assessmentTitle = title.trim() || `Assessment - ${new Date().toLocaleDateString()}`;

    setIsSubmitting(true);
    setError(null);

    try {
      // Fetch content if needed
      if (activeTab === "url") {
        toast.info("Fetching content from URL...");
        content = await fetchUrlContent(urlInput);
      } else if (activeTab === "document" && documentFile) {
        toast.info("Processing document...");
        if (documentFile.type === "text/plain") {
          content = await documentFile.text();
        } else {
          // For PDF/DOCX, we need to upload and extract
          const formData = new FormData();
          formData.append("file", documentFile);
          const response = await fetch("/api/extract-document-text", {
            method: "POST",
            body: formData,
          });
          if (!response.ok) {
            throw new Error("Failed to extract document text");
          }
          const data = await response.json();
          content = data.content;
        }
      } else if (activeTab === "social_media") {
        if (socialMediaUrl.trim()) {
          toast.info("Fetching social media content...");
          content = await fetchSocialMediaContent(socialMediaUrl);
        } else {
          content = socialMediaText;
        }
      }

      if (!content || content.trim().length < 50) {
        throw new Error("Not enough content to analyze. Please provide more text.");
      }

      // Create assessment record
      toast.info("Creating assessment...");
      const assessment = await createAssessment({
        title: assessmentTitle,
        input_type: activeTab,
        input_source: inputSource,
        content,
        organization_id: currentOrganization.id,
      });

      // Fire-and-forget: analysis runs in the background via Supabase Edge Function.
      // The detail page polls for completion every 3 seconds.
      toast.info("Analysis started. You'll see results shortly...");
      triggerAnalysis(assessment.id, content, activeTab, inputSource);

      router.push(`/greenwash-guardian/${assessment.id}`);
    } catch (err: any) {
      console.error("Error:", err);
      setError(err.message || "An error occurred");
      toast.error(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentOrganization) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please select an organisation to use Greenwash Guardian.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto p-6 max-w-4xl space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow className="mb-3">THE EVIDENCE · GUARDIAN</Eyebrow>
            <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-[-0.035em] text-foreground">
              The guardian.
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Analysis against UK and EU anti-greenwashing legislation.
            </p>
          </div>
          <Link href="/greenwash-guardian/history">
            <Button variant="outline">
              <History className="h-4 w-4 mr-2" />
              View History
            </Button>
          </Link>
        </header>

        {/* Disclaimer */}
        <Alert className="rounded-[6px] border-border bg-card">
          <Info className="h-4 w-4 text-studio-attention" />
          <AlertDescription className="text-muted-foreground">
            <strong className="text-foreground">Disclaimer:</strong> This tool provides guidance based on UK and EU anti-greenwashing
            legislation. It is not legal advice. Always consult qualified legal counsel for compliance decisions.
          </AlertDescription>
        </Alert>

        {/* Main Card */}
        <Card className="rounded-[6px]">
          <CardHeader>
            <CardTitle>New Assessment</CardTitle>
            <CardDescription>
              Analyse marketing content for potential greenwashing risks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Title Input */}
            <div className="space-y-2">
              <Label htmlFor="title">Assessment Title (optional)</Label>
              <Input
                id="title"
                placeholder="e.g., Website sustainability page review"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Input Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger
                  value="url"
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.15em]"
                >
                  <Globe className="h-4 w-4 mr-2" />
                  URL
                </TabsTrigger>
                <TabsTrigger
                  value="bulk"
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.15em]"
                >
                  <List className="h-4 w-4 mr-2" />
                  Bulk URLs
                </TabsTrigger>
                <TabsTrigger
                  value="document"
                  disabled={!canAnalyzeDocuments}
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] disabled:opacity-50"
                >
                  {!canAnalyzeDocuments ? <Lock className="h-4 w-4 mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                  Document
                </TabsTrigger>
                <TabsTrigger
                  value="text"
                  disabled={!canAnalyzeDocuments}
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] disabled:opacity-50"
                >
                  {!canAnalyzeDocuments ? <Lock className="h-4 w-4 mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                  Text
                </TabsTrigger>
                <TabsTrigger
                  value="social_media"
                  disabled={!canAnalyzeDocuments}
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] disabled:opacity-50"
                >
                  {!canAnalyzeDocuments ? <Lock className="h-4 w-4 mr-2" /> : <Share2 className="h-4 w-4 mr-2" />}
                  Social
                </TabsTrigger>
              </TabsList>

              {!canAnalyzeDocuments && (
                <p className="text-xs text-studio-attention mt-2">
                  Document, text and social media analysis requires a Blossom or Canopy plan.{" "}
                  <Link href="/dashboard/settings" className="underline">Upgrade</Link>
                </p>
              )}

              {canAnalyzeDocuments && !isGreenwashUnlimited && (
                <p className="text-xs text-muted-foreground mt-2">
                  5 document analyses per month on your plan.
                </p>
              )}

              <TabsContent value="url" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="url">Website URL</Label>
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://example.com/sustainability"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    We&apos;ll analyse the page and its subpages (up to 10 pages)
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="bulk" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="bulk-urls">URLs (one per line)</Label>
                  <Textarea
                    id="bulk-urls"
                    placeholder={"https://example.com/sustainability\nhttps://competitor.com/green-claims\nhttps://supplier.com/environment"}
                    value={bulkUrls}
                    onChange={(e) => setBulkUrls(e.target.value)}
                    disabled={isSubmitting}
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Enter up to 50 URLs to scan in batch. Each URL will be analysed separately.
                    </p>
                    <span className="text-xs font-mono text-muted-foreground">
                      {bulkUrls.split("\n").filter(u => u.trim()).length} / 50 URLS
                    </span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="document" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Upload Document</Label>
                  <div className="rounded-[6px] border border-studio-hairline bg-studio-cream p-8 text-center hover:border-studio-brick/50 transition-colors">
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={handleFileSelect}
                      disabled={isSubmitting}
                      className="hidden"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      {documentFile ? (
                        <div className="space-y-2">
                          <FileText className="h-10 w-10 text-studio-brick mx-auto" />
                          <p className="text-foreground font-medium">{documentFile.name}</p>
                          <p className="text-muted-foreground text-sm">
                            {(documentFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              setDocumentFile(null);
                            }}
                            className="mt-2"
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="h-10 w-10 text-muted-foreground mx-auto" />
                          <p className="text-muted-foreground">
                            Click to upload or drag and drop
                          </p>
                          <p className="text-muted-foreground text-sm">
                            PDF, DOCX, or TXT (max 10MB)
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="text" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="text">Marketing Copy / Press Release</Label>
                  <Textarea
                    id="text"
                    placeholder="Paste your marketing copy, press release, or any text content here..."
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    disabled={isSubmitting}
                    rows={10}
                  />
                  <p className="text-xs text-muted-foreground">
                    {textInput.length} characters
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="social_media" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="social-url">Social Media Post URL</Label>
                    <Input
                      id="social-url"
                      type="url"
                      placeholder="https://linkedin.com/posts/... or https://instagram.com/p/..."
                      value={socialMediaUrl}
                      onChange={(e) => setSocialMediaUrl(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="text-center text-muted-foreground text-sm">or</div>
                  <div className="space-y-2">
                    <Label htmlFor="social-text">Paste Post Content</Label>
                    <Textarea
                      id="social-text"
                      placeholder="Paste the social media post content here..."
                      value={socialMediaText}
                      onChange={(e) => setSocialMediaText(e.target.value)}
                      disabled={isSubmitting}
                      rows={6}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              size="lg"
              className="w-full bg-primary text-primary-foreground font-semibold"
            >
              {isSubmitting ? (
                <>Analysing...</>
              ) : (
                <>
                  <Shield className="mr-2 h-5 w-5" />
                  Analyse for Greenwashing Risks
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="rounded-[6px]">
            <CardHeader className="pb-2">
              <Eyebrow className="mb-1">UK</Eyebrow>
              <CardTitle className="text-lg">Legislation</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Green Claims Code (CMA)</li>
                <li>• Digital Markets, Competition and Consumers Act 2024</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-[6px]">
            <CardHeader className="pb-2">
              <Eyebrow className="mb-1">EU</Eyebrow>
              <CardTitle className="text-lg">Legislation</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Directive on Empowering Consumers for the Green Transition</li>
                <li>• Green Claims Directive</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
