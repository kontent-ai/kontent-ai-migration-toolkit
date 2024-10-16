import { WorkflowModels, WorkflowContracts } from '@kontent-ai/management-sdk';
import chalk from 'chalk';
import { findRequired } from '../utils/array.utils.js';

export type WorkflowStep = {
    readonly codename: string;
    readonly id: string;
};

type WorkflowMatcher = {
    readonly match: (workflow: Readonly<WorkflowModels.Workflow>, index: number) => boolean;
    readonly errorMessage: string;
};
type StepMatcher = {
    readonly match: (step: WorkflowStep, index: number) => boolean;
    readonly errorMessage: string;
};

type Steps =
    | WorkflowContracts.IWorkflowStepNewContract
    | WorkflowContracts.IWorkflowPublishedStepContract
    | WorkflowContracts.IWorkflowArchivedStepContract
    | WorkflowContracts.IWorkflowScheduledStepContract;

export function workflowHelper(workflows: readonly Readonly<WorkflowModels.Workflow>[]) {
    const getWorkflowStep = (workflow: Readonly<WorkflowModels.Workflow>, stepMatcher: StepMatcher): WorkflowStep => {
        return findRequired(
            [...workflow.steps, workflow.archivedStep, workflow.publishedStep, workflow.scheduledStep],
            stepMatcher.match,
            stepMatcher.errorMessage
        );
    };

    const getWorkflow = (workflowMatcher: WorkflowMatcher): Readonly<WorkflowModels.Workflow> => {
        return findRequired(workflows, workflowMatcher.match, workflowMatcher.errorMessage);
    };

    const getWorkflowByCodename = (workflowCodename: string): Readonly<WorkflowModels.Workflow> => {
        return getWorkflow({
            errorMessage: [
                `Workflow with codename '${chalk.red(workflowCodename)}' does not exist in target project`,
                `Available workflows are (${workflows.length}): ${workflows.map((m) => chalk.cyan(m.codename)).join(', ')}`
            ].join(', '),
            match: (workflow) => workflow.codename.toLowerCase() === workflowCodename.toLowerCase()
        });
    };

    const getWorkflowStepByCodename = (workflow: Readonly<WorkflowModels.Workflow>, stepCodename: string): WorkflowStep => {
        return getWorkflowStep(workflow, {
            errorMessage: [
                `Workflow step with codename '${chalk.red(stepCodename)}' does not exist in target project`,
                `Step in workflow '${chalk.yellow(workflow.codename)}' are (${workflows.length}): ${workflows
                    .map((m) => chalk.cyan(m.codename))
                    .join(', ')}`
            ].join(', '),
            match: (step) => step.codename.toLowerCase() === stepCodename.toLowerCase()
        });
    };

    const getWorkflowAndStep = (data: {
        readonly workflowMatcher: WorkflowMatcher;
        readonly stepMatcher: StepMatcher;
    }): { step: WorkflowStep; workflow: Readonly<WorkflowModels.Workflow> } => {
        const workflow = getWorkflow(data.workflowMatcher);
        return {
            workflow,
            step: getWorkflowStep(workflow, data.stepMatcher)
        };
    };

    const getWorkflowAndStepByCodenames = (data: {
        readonly workflowCodename: string;
        readonly stepCodename: string;
    }): { step: WorkflowStep; workflow: Readonly<WorkflowModels.Workflow> } => {
        const workflow = getWorkflowByCodename(data.workflowCodename);
        return {
            workflow,
            step: getWorkflowStepByCodename(workflow, data.stepCodename)
        };
    };

    const isPublishedStepByCodename = (stepCodename: string): boolean => {
        return workflows.find((workflow) => workflow.publishedStep.codename === stepCodename) ? true : false;
    };

    const isArchivedStepByCodename = (stepCodename: string): boolean => {
        return workflows.find((workflow) => workflow.archivedStep.codename === stepCodename) ? true : false;
    };

    const isScheduledStepByCodename = (stepCodename: string): boolean => {
        return workflows.find((workflow) => workflow.scheduledStep.codename === stepCodename) ? true : false;
    };

    const isPublishedStepById = (stepId: string): boolean => {
        return workflows.find((workflow) => workflow.publishedStep.id === stepId) ? true : false;
    };

    const findWorkflowPath = (workflow: Readonly<WorkflowModels.Workflow>, workflowStep: WorkflowStep): string[] => {
        const fromId = workflow.steps[0].id;
        const stepId = workflowStep.id;

        // If the start and end are the same, return empty path
        if (fromId === stepId) {
            return [];
        }

        // Create a map of id to WorkflowStep for easier lookup
        const stepMap = new Map<string, Steps>();
        
        for (const step of workflow.steps) {
            stepMap.set(step.id, step);
        }

        // Also add special steps to the map if they exist
        if (workflow.publishedStep?.id) {
            stepMap.set(workflow.publishedStep.id, workflow.publishedStep);
        }
        if (workflow.scheduledStep?.id) {
            stepMap.set(workflow.scheduledStep.id, workflow.scheduledStep);
        }
        if (workflow.archivedStep?.id) {
            stepMap.set(workflow.archivedStep.id, workflow.archivedStep);
        }

        // Check if both steps exist
        if (!stepMap.has(fromId) || !stepMap.has(stepId)) {
            throw new Error('One or both of the specified steps do not exist in the workflow');
        }

        // Queue for BFS
        const queue: Array<{ id: string; path: string[] }> = [];
        // Set to keep track of visited steps
        const visited = new Set<string>();

        // Start BFS
        queue.push({ id: fromId, path: [] });
        visited.add(fromId);

        while (queue.length > 0) {
            const { id, path } = queue.shift()!;
            const currentStep = stepMap.get(id)!;

            if ('transitions_to' in currentStep) {
                // Check each transition
                for (const {
                    step: { id: nextId }
                } of currentStep.transitions_to) {
                    if (nextId === undefined) {
                        continue;
                    }

                    if (nextId === stepId) {
                        // Found the target step, return the path
                        return [...path, nextId].map((id) => stepMap.get(id)!.codename);
                    }

                    if (!visited.has(nextId)) {
                        visited.add(nextId);
                        queue.push({
                            id: nextId,
                            path: [...path, nextId]
                        });
                    }
                }
            }
        }

        // If we get here, no path was found
        throw new Error(`No path found from ${fromId} to ${stepId}`);
    };

    return {
        getWorkflowByCodename,
        getWorkflowStepByCodename,
        getWorkflowAndStepByCodenames,
        getWorkflowStep,
        getWorkflowAndStep,
        getWorkflow,
        isPublishedStepByCodename,
        isArchivedStepByCodename,
        isScheduledStepByCodename,
        isPublishedStepById,
        findWorkflowPath
    };
}
