import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WidgetFormValues, widgetFormSchema } from '../types/mqtt';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { InsertWidget } from '@shared/schema';

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWidget: (widget: InsertWidget) => void;
}

export default function AddWidgetModal({ isOpen, onClose, onAddWidget }: AddWidgetModalProps) {
  const [topics, setTopics] = useState<string[]>([]);
  const { toast } = useToast();

  // Setup form
  const form = useForm<WidgetFormValues>({
    resolver: zodResolver(widgetFormSchema),
    defaultValues: {
      title: '',
      topic: '',
      jsonKeyPath: 'value',
      chartType: 'line',
      unit: ''
    }
  });

  // Fetch available topics when the modal opens
  useEffect(() => {
    if (isOpen) {
      const fetchTopics = async () => {
        try {
          const response = await fetch('/api/topics');
          if (response.ok) {
            const data = await response.json();
            setTopics(data.map((topic: any) => topic.path));
          }
        } catch (error) {
          console.error('Error fetching topics:', error);
          toast({
            title: 'Failed to load topics',
            description: 'There was an error loading the available topics.',
            variant: 'destructive',
          });
        }
      };

      fetchTopics();

      // Reset form when opening
      form.reset({
        title: '',
        topic: '',
        jsonKeyPath: 'value',
        chartType: 'line',
        unit: ''
      });
    }
  }, [isOpen, form, toast]);

  // Handle form submission
  const onSubmit = (values: WidgetFormValues) => {
    onAddWidget(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Chart</DialogTitle>
          <DialogDescription>
            Create a new chart to visualize your MQTT data.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Chart Title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="topic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Topic</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a topic" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {topics.length === 0 ? (
                        <SelectItem value="" disabled>No topics available</SelectItem>
                      ) : (
                        topics.map((topic, index) => (
                          <SelectItem key={index} value={topic}>
                            {topic}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="jsonKeyPath"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>JSON Key Path</FormLabel>
                  <FormControl>
                    <Input placeholder="value" {...field} />
                  </FormControl>
                  <p className="text-xs text-gray-500 mt-1">
                    Enter the key path to extract from JSON messages (e.g., "data.value")
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="chartType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chart Type</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select chart type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="line">Line Chart</SelectItem>
                      <SelectItem value="bar">Bar Chart</SelectItem>
                      <SelectItem value="gauge">Gauge</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="°C" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                Create Chart
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
