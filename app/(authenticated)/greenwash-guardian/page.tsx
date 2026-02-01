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
  Loader2,
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

      // Trigger analysis
      toast.info("Analyzing content for greenwashing risks...");
      const result = await triggerAnalysis(
        assessment.id,
        content,
        activeTab,
        inputSource
      );

      if (!result.success) {
        throw new Error(result.error || "Analysis failed");
      }

      toast.success("Analysis complete!");
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
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 container mx-auto p-6 max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <Shield className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Greenwash Guardian</h1>
              <p className="text-slate-400 mt-1">
                AI-powered analysis against UK & EU anti-greenwashing legislation
              </p>
            </div>
          </div>
          <Link href="/greenwash-guardian/history">
            <Button variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10">
              <History className="h-4 w-4 mr-2" />
              View History
            </Button>
          </Link>
        </div>

        {/* Disclaimer */}
        <Alert className="bg-amber-500/10 border-amber-500/30">
          <Info className="h-4 w-4 text-amber-400" />
          <AlertDescription className="text-amber-200">
            <strong>Disclaimer:</strong> This tool provides guidance based on UK and EU anti-greenwashing
            legislation. It is not legal advice. Always consult qualified legal counsel for compliance decisions.
          </AlertDescription>
        </Alert>

        {/* Main Card */}
        <Card className="backdrop-blur-xl bg-white/5 border border-white/10">
          <CardHeader>
            <CardTitle className="text-white">New Assessment</CardTitle>
            <CardDescription className="text-slate-400">
              Analyze marketing content for potential greenwashing risks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Title Input */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-slate-300">Assessment Title (optional)</Label>
              <Input
                id="title"
                placeholder="e.g., Website sustainability page review"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSubmitting}
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
              />
            </div>

            {/* Input Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
              <TabsList className="grid w-full grid-cols-5 bg-white/5 border border-white/10">
                <TabsTrigger
                  value="url"
                  className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 text-slate-400"
                >
                  <Globe className="h-4 w-4 mr-2" />
                  URL
                </TabsTrigger>
                <TabsTrigger
                  value="bulk"
                  className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 text-slate-400"
                >
                  <List className="h-4 w-4 mr-2" />
                  Bulk URLs
                </TabsTrigger>
                <TabsTrigger
                  value="document"
                  disabled={!canAnalyzeDocuments}
                  className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 text-slate-400 disabled:opacity-50"
                >
                  {!canAnalyzeDocuments ? <Lock className="h-4 w-4 mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                  Document
                </TabsTrigger>
                <TabsTrigger
                  value="text"
                  disabled={!canAnalyzeDocuments}
                  className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 text-slate-400 disabled:opacity-50"
                >
                  {!canAnalyzeDocuments ? <Lock className="h-4 w-4 mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                  Text
                </TabsTrigger>
                <TabsTrigger
                  value="social_media"
                  disabled={!canAnalyzeDocuments}
                  className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 text-slate-400 disabled:opacity-50"
                >
                  {!canAnalyzeDocuments ? <Lock className="h-4 w-4 mr-2" /> : <Share2 className="h-4 w-4 mr-2" />}
                  Social
                </TabsTrigger>
              </TabsList>

              {!canAnalyzeDocuments && (
                <p className="text-xs text-amber-400/80 mt-2">
                  Document, text and social media analysis requires a Blossom or Canopy plan.{" "}
                  <Link href="/dashboard/settings" className="underline">Upgrade</Link>
                </p>
              )}

              {canAnalyzeDocuments && !isGreenwashUnlimited && (
                <p className="text-xs text-slate-400 mt-2">
                  5 document analyses per month on your plan.
                </p>
              )}

              <TabsContent value="url" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="url" className="text-slate-300">Website URL</Label>
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://example.com/sustainability"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    disabled={isSubmitting}
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                  />
                  <p className="text-xs text-slate-500">
                    We&apos;ll analyze the page and its subpages (up to 10 pages)
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="bulk" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="bulk-urls" className="text-slate-300">URLs (one per line)</Label>
                  <Textarea
                    id="bulk-urls"
                    placeholder={"https://example.com/sustainability\nhttps://competitor.com/green-claims\nhttps://supplier.com/environment"}
                    value={bulkUrls}
                    onChange={(e) => setBulkUrls(e.target.value)}
                    disabled={isSubmitting}
                    rows={8}
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 font-mono text-sm"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      Enter up to 50 URLs to scan in batch. Each URL will be analyzed separately.
                    </p>
                    <span className="text-xs text-slate-400">
                      {bulkUrls.split("\n").filter(u => u.trim()).length} / 50 URLs
                    </span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="document" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Upload Document</Label>
                  <div className="border-2 border-dashed border-white/10 rounded-lg p-8 text-center hover:border-emerald-500/50 transition-colors">
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
                          <FileText className="h-10 w-10 text-emerald-400 mx-auto" />
                          <p className="text-white font-medium">{documentFile.name}</p>
                          <p className="text-slate-500 text-sm">
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
                          <Upload className="h-10 w-10 text-slate-500 mx-auto" />
                          <p className="text-slate-400">
                            Click to upload or drag and drop
                          </p>
                          <p className="text-slate-500 text-sm">
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
                  <Label htmlFor="text" className="text-slate-300">Marketing Copy / Press Release</Label>
                  <Textarea
                    id="text"
                    placeholder="Paste your marketing copy, press release, or any text content here..."
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    disabled={isSubmitting}
                    rows={10}
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                  />
                  <p className="text-xs text-slate-500">
                    {textInput.length} characters
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="social_media" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="social-url" className="text-slate-300">Social Media Post URL</Label>
                    <Input
                      id="social-url"
                      type="url"
                      placeholder="https://linkedin.com/posts/... or https://instagram.com/p/..."
                      value={socialMediaUrl}
                      onChange={(e) => setSocialMediaUrl(e.target.value)}
                      disabled={isSubmitting}
                      className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div className="text-center text-slate-500 text-sm">or</div>
                  <div className="space-y-2">
                    <Label htmlFor="social-text" className="text-slate-300">Paste Post Content</Label>
                    <Textarea
                      id="social-text"
                      placeholder="Paste the social media post content here..."
                      value={socialMediaText}
                      onChange={(e) => setSocialMediaText(e.target.value)}
                      disabled={isSubmitting}
                      rows={6}
                      className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
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
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-5 w-5" />
                  Analyze for Greenwashing Risks
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="backdrop-blur-xl bg-white/5 border border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <span className="text-xl">🇬🇧</span> UK Legislation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>• Green Claims Code (CMA)</li>
                <li>• Digital Markets, Competition and Consumers Act 2024</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-xl bg-white/5 border border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <span className="text-xl">🇪🇺</span> EU Legislation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-slate-400 space-y-1">
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
