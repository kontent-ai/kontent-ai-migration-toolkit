import { WorkflowContracts, WorkflowModels } from '@kontent-ai/management-sdk';
import chalk from 'chalk';
import { findRequired } from '../utils/array.utils.js';

interface TransitionTo {
    readonly codename: string;
    readonly id: string;
}

export type WorkflowStep = {
    readonly codename: string;
    readonly id: string;
    readonly transitionsTo: readonly TransitionTo[];
};

type WorkflowMatcher = {
    readonly match: (workflow: Readonly<WorkflowModels.Workflow>, index: number) => boolean;
    readonly errorMessage: string;
};
type StepMatcher = {
    readonly match: (step: WorkflowStep, index: number) => boolean;
    readonly errorMessage: string;
};

export function workflowHelper(workflows: readonly Readonly<WorkflowModels.Workflow>[]) {
    const mapContractToWorkflowSteps = (
        workflow: Readonly<WorkflowModels.Workflow>,
        stepsContract: readonly Readonly<WorkflowContracts.IWorkflowStepNewContract>[]
    ): readonly WorkflowStep[] => {
        const allStepsContracts = [...workflow.steps, workflow.archivedStep, workflow.publishedStep, workflow.scheduledStep];

        return stepsContract.map<WorkflowStep>((m) => {
            return {
                codename: m.codename,
                id: m.id,
                transitionsTo: m.transitions_to.map((transitionTo) => {
                    const transitionStep = allStepsContracts.find((step) => step.id === transitionTo.step.id);

                    if (!transitionStep) {
                        throw Error(`Could not find transition step with id '${transitionTo.step.id}' in workflow '${workflow.codename}'`);
                    }

                    return {
                        codename: transitionStep.codename,
                        id: transitionStep.id
                    };
                })
            };
        });
    };

    const getWorkflowStep = (workflow: Readonly<WorkflowModels.Workflow>, stepMatcher: StepMatcher): WorkflowStep => {
        const workflowSteps: readonly WorkflowStep[] = [
            ...mapContractToWorkflowSteps(workflow, workflow.steps),
            {
                codename: workflow.archivedStep.codename,
                id: workflow.archivedStep.id,
                transitionsTo: []
            },
            {
                codename: workflow.publishedStep.codename,
                id: workflow.publishedStep.id,
                transitionsTo: []
            },
            {
                codename: workflow.scheduledStep.codename,
                id: workflow.scheduledStep.id,
                transitionsTo: []
            }
        ];

        return findRequired(workflowSteps, stepMatcher.match, stepMatcher.errorMessage);
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
                `Steps in workflow '${chalk.yellow(workflow.codename)}' are (${workflow.steps.length}): ${workflow.steps
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

    const findShortestPathBetweenSteps = (workflow: WorkflowModels.Workflow, startStep: WorkflowStep, endStep: WorkflowStep): ReadonlyArray<string> => {
        type Node = Readonly<{ parent: null | Node, step: WorkflowStep }>
        let deque: Array<Node> = [{ parent: null, step: startStep }];

        const getResult = (node: Node): ReadonlyArray<string> => node.parent === null ? [] : [...getResult(node.parent), node.step.codename]

        while (deque.length !== 0) {
            const node = deque.shift() as Node;

            if (node.step.codename === endStep.codename) {
                return getResult(node)
            }

            const newNodes = node.step.transitionsTo
                .filter(s => deque.find(n => n.step.codename === s.codename) === undefined)
                .map(t => ({
                    parent: node, step: getWorkflowStepByCodename(workflow, t.codename)
                }))

            deque = deque.concat(newNodes)
        }

        throw new Error(`Could not find the path from step (codename: ${startStep.codename}) to step (codename: ${endStep.codename}) in workflow (codename: ${workflow.codename})`);
    }

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
        findShortestPathBetweenSteps
    };
}
