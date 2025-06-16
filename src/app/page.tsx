"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
} from "@dnd-kit/core";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarLeft } from "@/components/form-builder/sidebar/sidebarLeft";
import { SidebarRight } from "@/components/form-builder/sidebar/sidebarRight";
import { MainCanvas } from "@/components/form-builder/mainCanvas";
import {
  EyeIcon,
  Monitor,
  Tablet,
  Smartphone,
  BlocksIcon,
  CodeIcon,
  PlayIcon,
  XIcon,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { useFormBuilderStore } from "@/stores/form-builder-store";
import { Button } from "@/components/ui/button";
import { ToggleGroupNav } from "@/components/form-builder/ui/toggle-group-nav";
import { useCallback, useMemo, useState } from "react";
import {
  DependenciesImports,
} from "@/components/form-builder/helpers/generate-react-code";
import { MainExport } from "@/components/form-builder/dialogs/generate-code-dialog";
import { MobileNotification } from "@/components/form-builder/ui/mobile-notification";
import SocialLinks from "@/components/form-builder/sidebar/socialLinks";
import { OpenJsonDialog } from "@/components/form-builder/dialogs/open-json-dialog";
import { useForm } from "react-hook-form";
import { cn, getGridRows, updateColSpans } from "@/lib/utils";
import { EditorToolbar } from "@/components/form-builder/form-components/wysiwyg/editor-toolbar";

export default function FormBuilderPage() {
  // Split the store selectors to only subscribe to what we need
  const viewport = useFormBuilderStore((state) => state.viewport);
  const mode = useFormBuilderStore((state) => state.mode);
  const showJson = useFormBuilderStore((state) => state.showJson);
  const formTitle = useFormBuilderStore((state) => state.formTitle);
  const updateViewport = useFormBuilderStore((state) => state.updateViewport);
  const updateMode = useFormBuilderStore((state) => state.updateMode);
  const updateFormTitle = useFormBuilderStore((state) => state.updateFormTitle);
  const toggleJsonPreview = useFormBuilderStore(
    (state) => state.toggleJsonPreview
  );
  const components = useFormBuilderStore((state) => state.components);
  const selectComponent = useFormBuilderStore((state) => state.selectComponent);

  const [generatedCode, setGeneratedCode] = useState<{
    code: string;
    dependenciesImports: DependenciesImports;
  }>({ code: "", dependenciesImports: {} });

  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  const [draggingDOMElement, setDraggingDOMElement] =
    useState<HTMLElement | null>(null);
  const form = useForm();

  // Memoize static values
  const viewportItems = useMemo(
    () => [
      { value: "lg", icon: Monitor },
      { value: "md", icon: Tablet },
      { value: "sm", icon: Smartphone },
    ],
    []
  );

  const updateComponent = useFormBuilderStore((state) => state.updateComponent);
  const moveComponent = useFormBuilderStore((state) => state.moveComponent);
  const addComponent = useFormBuilderStore((state) => state.addComponent);
  const gridRows = getGridRows(components, viewport);
  const editor = useFormBuilderStore((state) => state.editor);

  // Create sensors outside of callback
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 20,
    },
  });

  // Memoize sensors array
  const sensors = useMemo(() => [pointerSensor], [pointerSensor]);

  // Memoize drag end handler
  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (!over) {
      return;
    }

    const action: "move" | "add" = active.data.current.action;
    let activeComponent = active.data.current.component;
    const overComponent = over.data.current.component;
    const position = over.data.current.position;
    const activeIndex = active.data.current.index;
    const overIndex = over.data.current.index;

    if (action === "add") {
      activeComponent = addComponent(active.data.current.component);
    }

    if (
      (activeIndex === overIndex &&
        (position === "left" || position === "right")) ||
      // Or the diff between active and over is 1
      (activeIndex - overIndex === 1 && position === "bottom") ||
      (overIndex - activeIndex === 1 && position === "top")
    ) {
      return;
    }

    if (activeComponent && overComponent) {
      const overRowItems =
        gridRows.find((row) =>
          row.some((item) => item.id === over.data.current?.component.id)
        ) || [];

      const overRowFirstItemIndex = components.findIndex(
        (component) => component.id === overRowItems[0].id
      );

      const overRowLastItemIndex = components.findIndex(
        (component) => component.id === overRowItems[overRowItems.length - 1].id
      );

      let activeRowItems =
        gridRows.find((row) =>
          row.some((item) => item.id === active.data.current?.component.id)
        ) || [];

      let draggingInSameRow = overRowItems === activeRowItems;

      // Don´t update the spans if the component is being dragged in the same row
      activeRowItems = activeRowItems.filter(
        (item) => item.id !== activeComponent.id
      );
      let updatedOverItems = [];

      if (position === "top" || position === "bottom") {
        updatedOverItems = updateColSpans([activeComponent]);
      } else {
        updatedOverItems = updateColSpans([...overRowItems, activeComponent]);
      }

      if (
        (!draggingInSameRow && (position === "left" || position === "right")) ||
        position === "top" ||
        position === "bottom"
      ) {
        updatedOverItems.forEach((item) => {
          updateComponent(
            item.id,
            "properties.style.colSpan",
            `${item.span}`,
            false,
            true
          );
        });

        const updatedActiveItems = updateColSpans([...activeRowItems]);

        updatedActiveItems.forEach((item) => {
          updateComponent(
            item.id,
            "properties.style.colSpan",
            `${item.span}`,
            false,
            true
          );
        });
      }

      const oldIndex = active.data.current.index;
      let newIndex =
        position === "left"
          ? overIndex
          : activeIndex < overIndex
            ? overIndex
            : overIndex + 1;

      if (position === "top") {
        newIndex =
          activeIndex < overIndex
            ? overRowFirstItemIndex - 1
            : overRowFirstItemIndex;
      }

      if (position === "bottom") {
        newIndex =
          activeIndex < overIndex
            ? overRowLastItemIndex
            : overRowLastItemIndex + 1;
      }

      moveComponent(oldIndex, newIndex);
    }
  };

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      selectComponent(null);
      const element = document.querySelector(
        `[data-item-id="${event.active.data.current?.component.id}"]`
      );
      if (element) {
        setDraggingDOMElement(element as HTMLElement);
      }
    },
    [selectComponent]
  );

  return (
    <div>
      <div
        className={cn(
          "fixed top-0 w-full flex flex-row gap-2 justify-between bg-white border-b z-30"
        )}
      >
        <div className="flex flex-row gap-2 items-center justify-center md:justify-start p-2 px-4 border-r w-full md:w-[300px]">
          <BlocksIcon className="h-6 w-6" strokeWidth={2} />
          <h2 className="text-lg font-semibold">
            shadcn/ui <span className="font-normal">Builder</span>
            <sup className="text-xs text-muted-foreground font-normal ml-1">
              Beta
            </sup>
          </h2>
        </div>
        <div className="p-2 flex-1 grid grid-cols-7 2xl:grid-cols-3">
          {mode === "editor" && (
            <>
              <div
                className={cn(
                  "hidden 2xl:block col-span-1",
                  editor && "2xl:hidden"
                )}
              >
                {process.env.NODE_ENV === "development" && <OpenJsonDialog />}
              </div>
              <div className="col-span-5 2xl:col-span-1 2xl:col-start-2 flex 2xl:justify-center">
                {editor ? (
                  <EditorToolbar editor={editor} isEditable={true} />
                ) : (
                  <div className="text-center flex flex-row items-center justify-center gap-1 border rounded-md h-9 px-4">
                    <div
                      className="max-w-80 overflow-y-hidden whitespace-nowrap text-sm outline-none scrollbar-hide"
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => updateFormTitle(e.target.innerText)}
                    >
                      {formTitle}
                    </div>
                    <span className="text-muted-foreground text-xs">.tsx</span>
                  </div>
                )}
              </div>
            </>
          )}
          <div
            className={cn(
              "col-span-2 2xl:col-span-1 hidden md:flex justify-end gap-4",
              editor && "",
              mode === "preview" && "justify-center col-span-7 2xl:col-span-3"
            )}
          >
            {process.env.NODE_ENV === "development" && mode === "editor" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleJsonPreview}
                className={showJson ? "bg-slate-100" : ""}
              >
                <CodeIcon className="h-4 w-4" />
              </Button>
            )}
            {mode !== "export" && (
              <ToggleGroupNav
                name="viewport"
                items={viewportItems}
                defaultValue={viewport}
                onValueChange={(value) =>
                  updateViewport(value as "sm" | "md" | "lg")
                }
              />
            )}
          </div>
        </div>
        <div className="hidden md:flex flex-row gap-2 border-l py-2 px-4 w-[300px]">
          {mode === "editor" && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer flex-1"
                onClick={() => {
                  updateMode("preview");
                  selectComponent(null);
                }}
              >
                <PlayIcon className="h-4 w-4" />
                Preview
              </Button>
              <Button
                variant="default"
                size="sm"
                className="cursor-pointer flex-1"
                onClick={() => {
                  updateMode("export");
                  selectComponent(null);
                }}
                disabled={components.length === 0}
                id="export-code-button"
              >
                {isGeneratingCode ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                Export
              </Button>
            </>
          )}
          {mode === "preview" && (
            <Button
              variant="default"
              size="sm"
              className="cursor-pointer w-full"
              onClick={() => updateMode("editor")}
            >
              <XIcon className="h-4 w-4" />
              Exit Preview
            </Button>
          )}
          {mode === "export" && (
            <Button
              variant="default"
              size="sm"
              className="cursor-pointer w-full"
              onClick={() => updateMode("editor")}
            >
              <XIcon className="h-4 w-4" />
              Exit Export
            </Button>
          )}
        </div>
      </div>

      {/* Mobile notification - always rendered but hidden on desktop */}
      <div className="md:hidden">
        <MobileNotification />
        <div className="fixed bottom-0 w-full p-4 border-t">
          <SocialLinks />
        </div>
      </div>

      {/* Desktop layout - always rendered but hidden on mobile */}
      <SidebarProvider
        className="relative hidden md:block"
        style={{ "--sidebar-width": "300px" } as React.CSSProperties}
        open={mode === "editor"}
      >
        <DndContext
          id="form-builder"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          onDragStart={handleDragStart}
        >
          <div className="flex w-full h-screen justify-between">
            <SidebarLeft />

            <main
              className={cn(
                "flex-1 transition-all duration-300 overflow-auto relative bg-dotted pt-14 scrollbar-hide",
                mode === "preview" || mode === "export" && "bg-slate-50"
              )}
            >
              {mode === "export" ? (
                <MainExport />
              ) : (
                <MainCanvas />
              )}
            </main>
            <SidebarRight />
          </div>
          <DragOverlay>
            {draggingDOMElement && (
              <div className="bg-white p-2 rounded-md shadow opacity-80">
                <div
                  dangerouslySetInnerHTML={{
                    __html: draggingDOMElement.innerHTML,
                  }}
                  className="max-h-52 overflow-hidden"
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </SidebarProvider>
    </div>
  );
}