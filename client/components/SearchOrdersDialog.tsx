import React, { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";

export type SearchOrdersForm = {
  orderNumber: string;
  lastName: string;
  firstName: string;
  birthday: string;
  examType: "B1" | "B2" | "C1" | "";
  examDate: string;
};

type SearchOrdersDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: (criteria: SearchOrdersForm) => void;
};

// Mock exam dates - in real implementation, these would come from settings
const EXAM_DATES = {
  B1: ["2024-01-15", "2024-02-15", "2024-03-15", "2024-04-15"],
  B2: ["2024-01-20", "2024-02-20", "2024-03-20", "2024-04-20"],
  C1: ["2024-01-25", "2024-02-25", "2024-03-25", "2024-04-25"],
};

export function SearchOrdersDialog({ open, onOpenChange, onSearch }: SearchOrdersDialogProps) {
  const { t } = useI18n();
  const [form, setForm] = useState<SearchOrdersForm>({
    orderNumber: "",
    lastName: "",
    firstName: "",
    birthday: "",
    examType: "",
    examDate: "",
  });

  const handleInputChange = (field: keyof SearchOrdersForm, value: string) => {
    setForm(prev => ({
      ...prev,
      [field]: value,
      // Reset exam date when exam type changes
      ...(field === 'examType' ? { examDate: "" } : {})
    }));
  };

  const handleSearch = () => {
    onSearch(form);
    onOpenChange(false);
  };

  const handleClear = () => {
    setForm({
      orderNumber: "",
      lastName: "",
      firstName: "",
      birthday: "",
      examType: "",
      examDate: "",
    });
  };

  const availableExamDates = form.examType ? EXAM_DATES[form.examType] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("searchOrdersDialog", "Search Orders")}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orderNumber">{t("orderNumber", "Order Number")}</Label>
            <Input
              id="orderNumber"
              value={form.orderNumber}
              onChange={(e) => handleInputChange("orderNumber", e.target.value)}
              placeholder={t("orderNumber", "Order Number")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">{t("lastName", "Last Name")}</Label>
            <Input
              id="lastName"
              value={form.lastName}
              onChange={(e) => handleInputChange("lastName", e.target.value)}
              placeholder={t("lastName", "Last Name")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="firstName">{t("firstName", "First Name")}</Label>
            <Input
              id="firstName"
              value={form.firstName}
              onChange={(e) => handleInputChange("firstName", e.target.value)}
              placeholder={t("firstName", "First Name")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="birthday">{t("birthday", "Birthday")}</Label>
            <Input
              id="birthday"
              type="date"
              value={form.birthday}
              onChange={(e) => handleInputChange("birthday", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("examType", "Exam Type")}</Label>
              <Select
                value={form.examType}
                onValueChange={(value) => handleInputChange("examType", value as "B1" | "B2" | "C1")}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectExamType", "Select Exam Type")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="B1">B1</SelectItem>
                  <SelectItem value="B2">B2</SelectItem>
                  <SelectItem value="C1">C1</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("examDate", "Exam Date")}</Label>
              <Select
                value={form.examDate}
                onValueChange={(value) => handleInputChange("examDate", value)}
                disabled={!form.examType}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectExamDate", "Select Exam Date")} />
                </SelectTrigger>
                <SelectContent>
                  {availableExamDates.map((date) => (
                    <SelectItem key={date} value={date}>
                      {new Date(date).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClear}>
            {t("clear", "Clear")}
          </Button>
          <Button onClick={handleSearch}>
            {t("search", "Search")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
