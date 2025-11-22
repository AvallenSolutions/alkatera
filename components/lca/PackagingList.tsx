"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Database, Building2, Sprout, Edit, Trash2, Package, Tag, Grip, Box } from "lucide-react";
import type { PackagingMaterial } from "@/lib/packagingOperations";

interface PackagingListProps {
  packaging: (PackagingMaterial & { supplier_name?: string | null })[];
  onEdit: (packaging: PackagingMaterial & { supplier_name?: string | null }) => void;
  onRemove: (packagingId: string) => void;
  disabled?: boolean;
}

const CATEGORY_CONFIG = {
  container: {
    label: 'Containers',
    icon: Package,
    color: 'blue',
    emptyMessage: 'No containers added yet',
  },
  label: {
    label: 'Labels',
    icon: Tag,
    color: 'yellow',
    emptyMessage: 'No labels added yet',
  },
  closure: {
    label: 'Closures',
    icon: Grip,
    color: 'green',
    emptyMessage: 'No closures added yet',
  },
  secondary: {
    label: 'Secondary Packaging',
    icon: Box,
    color: 'purple',
    emptyMessage: 'No secondary packaging added yet',
  },
};

export function PackagingList({
  packaging,
  onEdit,
  onRemove,
  disabled = false,
}: PackagingListProps) {
  const getSourceBadge = (item: PackagingMaterial & { supplier_name?: string | null }) => {
    const { data_source, supplier_name } = item;

    if (data_source === 'supplier') {
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 text-xs">
          <Building2 className="h-3 w-3 mr-1" />
          {supplier_name || 'Supplier'}
        </Badge>
      );
    }

    if (data_source === 'primary') {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 text-xs">
          <Sprout className="h-3 w-3 mr-1" />
          Primary
        </Badge>
      );
    }

    return (
      <Badge className="bg-grey-100 text-grey-800 dark:bg-grey-800 dark:text-grey-100 text-xs">
        <Database className="h-3 w-3 mr-1" />
        Database
      </Badge>
    );
  };

  const groupedPackaging = {
    container: packaging.filter(p => p.packaging_category === 'container'),
    label: packaging.filter(p => p.packaging_category === 'label'),
    closure: packaging.filter(p => p.packaging_category === 'closure'),
    secondary: packaging.filter(p => p.packaging_category === 'secondary'),
  };

  if (packaging.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No packaging added yet</p>
        <p className="text-xs mt-1">Select a category and search above to add packaging</p>
      </div>
    );
  }

  return (
    <Accordion type="multiple" defaultValue={['container', 'label', 'closure', 'secondary']} className="space-y-3">
      {Object.entries(CATEGORY_CONFIG).map(([category, config]) => {
        const items = groupedPackaging[category as keyof typeof groupedPackaging];
        const Icon = config.icon;

        return (
          <AccordionItem key={category} value={category} className="border rounded-lg">
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5" />
                <span className="font-semibold">{config.label}</span>
                <Badge variant="secondary">{items.length}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-2">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {config.emptyMessage}
                </p>
              ) : (
                items.map((item) => (
                  <Card key={item.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="text-base font-semibold">{item.name}</h3>
                            {getSourceBadge(item)}
                          </div>

                          <div className="flex items-center gap-4 text-sm flex-wrap">
                            <div>
                              <span className="text-muted-foreground">Quantity:</span>{' '}
                              <span className="font-medium">
                                {item.quantity} {item.unit}
                              </span>
                            </div>

                            {item.label_printing_type && (
                              <div>
                                <span className="text-muted-foreground">Printing:</span>{' '}
                                <span className="font-medium capitalize">{item.label_printing_type}</span>
                              </div>
                            )}

                            {item.origin_country && (
                              <div className="text-muted-foreground">
                                Origin: {item.origin_country}
                              </div>
                            )}

                            {item.is_organic_certified && (
                              <Badge variant="outline" className="text-xs">
                                Organic
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(item)}
                            disabled={disabled}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemove(item.id)}
                            disabled={disabled}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
